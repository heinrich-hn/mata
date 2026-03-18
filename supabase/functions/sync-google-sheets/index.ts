// Trip & Diesel Reports - Google Sheets Sync
// Pushes trip report and diesel consumption data to Google Sheets on a schedule

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Google Sheets API helper
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson)

  // Create JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }

  // Create JWT claims
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  // Base64url encode
  const base64url = (obj: object) => {
    const json = JSON.stringify(obj)
    const base64 = btoa(json)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  const unsignedToken = `${base64url(header)}.${base64url(claims)}`

  // Sign with private key
  const privateKey = serviceAccount.private_key
  const encoder = new TextEncoder()
  const data = encoder.encode(unsignedToken)

  // Import the private key
  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const pemContents = privateKey.substring(
    privateKey.indexOf(pemHeader) + pemHeader.length,
    privateKey.indexOf(pemFooter)
  ).replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, data)
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const jwt = `${unsignedToken}.${signatureBase64}`

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

// Update Google Sheet
async function ensureSheetExists(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<void> {
  try {
    // Try to add the sheet tab; if it already exists, the API returns an error which we ignore
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: { title: sheetName }
            }
          }]
        }),
      }
    )
    // 200 = created, 400 = already exists — both are fine
    if (!res.ok) {
      const body = await res.text()
      if (!body.includes('already exists')) {
        console.error(`Failed to ensure sheet "${sheetName}":`, body)
      }
    }
  } catch (e) {
    console.error(`Error ensuring sheet "${sheetName}":`, e)
  }
}

async function updateSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  data: any[][]
): Promise<void> {
  // Ensure the sheet tab exists before writing
  await ensureSheetExists(accessToken, spreadsheetId, sheetName)

  // Clear existing data
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  // Write new data
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: sheetName,
        majorDimension: 'ROWS',
        values: data,
      }),
    }
  )
}

// Sync Diesel Reports to Google Sheets
async function syncDieselReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string,
  startDate: Date | null,
  period: string
): Promise<Response> {
  // Fetch diesel records
  let dieselQuery = supabase
    .from('diesel_records')
    .select('*')
    .order('date', { ascending: false })

  if (startDate) {
    dieselQuery = dieselQuery.gte('date', startDate.toISOString().split('T')[0])
  }

  const { data: dieselRecords, error: dieselError } = await dieselQuery
  if (dieselError) throw new Error(`Failed to fetch diesel records: ${dieselError.message}`)

  // Fetch diesel norms
  const { data: dieselNorms } = await supabase
    .from('diesel_norms')
    .select('*')
    .order('fleet_number')

  const normsMap = new Map((dieselNorms || []).map((n: any) => [n.fleet_number, n]))

  // Build aggregated data
  const fleetMap = new Map<string, any>()
  const driverMap = new Map<string, any>()
  const stationMap = new Map<string, any>()
  const weeklyMap = new Map<string, any>()
  const monthlyMap = new Map<string, any>()

  let totalLitres = 0
  let totalCostZAR = 0
  let totalCostUSD = 0
  let totalKm = 0
  let totalPendingDebriefs = 0
  let totalCompletedDebriefs = 0

  const allDieselRecords = dieselRecords || []

  // Helper to identify reefer fleets (fleet numbers ending in 'F')
  const isReeferFleet = (fleet: string) => !!fleet && fleet.toUpperCase().trim().endsWith('F')

  // Split: truck records only (exclude reefer fleets)
  const records = allDieselRecords.filter((r: any) => !isReeferFleet(r.fleet_number || ''))

  // Fetch reefer diesel records from dedicated table
  let reeferQuery = supabase
    .from('reefer_diesel_records')
    .select('*')
    .order('date', { ascending: false })

  if (startDate) {
    reeferQuery = reeferQuery.gte('date', startDate.toISOString().split('T')[0])
  }

  const { data: reeferDieselRecords, error: reeferError } = await reeferQuery
  if (reeferError) console.error('Failed to fetch reefer records:', reeferError.message)

  // Also include any legacy reefer records from diesel_records that haven't been migrated
  const legacyReeferRecords = allDieselRecords.filter((r: any) => isReeferFleet(r.fleet_number || ''))
  const reeferFromTable = reeferDieselRecords || []
  
  // Merge: reefer_diesel_records take precedence, then legacy
  const reeferIdSet = new Set(reeferFromTable.map((r: any) => r.id))
  const mergedReeferRecords = [
    ...reeferFromTable,
    ...legacyReeferRecords.filter((r: any) => !reeferIdSet.has(r.id))
  ]

  records.forEach((record: any) => {
    const litres = record.litres_filled || 0
    const cost = record.total_cost || 0
    const km = record.distance_travelled || 0
    const currency = record.currency || 'ZAR'
    const fleetNumber = (record.fleet_number || '').toUpperCase().trim()
    const driverName = record.driver_name || 'Unknown'
    const station = record.fuel_station || 'Unknown'
    const kmPerLitre = record.km_per_litre || (litres > 0 && km > 0 ? km / litres : null)

    // Check if debrief required
    const norm = normsMap.get(fleetNumber)
    const requiresDebrief = kmPerLitre !== null && norm && kmPerLitre < norm.min_acceptable

    if (requiresDebrief && !record.debrief_signed) totalPendingDebriefs++
    if (record.debrief_signed) totalCompletedDebriefs++

    // Overall totals
    totalLitres += litres
    if (currency === 'USD') totalCostUSD += cost
    else totalCostZAR += cost
    totalKm += km

    // Fleet summary
    if (fleetNumber) {
      const fleet = fleetMap.get(fleetNumber) || {
        fills: 0, litres: 0, km: 0, cost_zar: 0, cost_usd: 0, pending_debriefs: 0
      }
      fleet.fills += 1
      fleet.litres += litres
      fleet.km += km
      if (currency === 'USD') fleet.cost_usd += cost
      else fleet.cost_zar += cost
      if (requiresDebrief && !record.debrief_signed) fleet.pending_debriefs++
      fleetMap.set(fleetNumber, fleet)
    }

    // Driver summary
    const driver = driverMap.get(driverName) || {
      fills: 0, litres: 0, km: 0, cost_zar: 0, cost_usd: 0, fleets: new Set()
    }
    driver.fills += 1
    driver.litres += litres
    driver.km += km
    if (currency === 'USD') driver.cost_usd += cost
    else driver.cost_zar += cost
    if (fleetNumber) driver.fleets.add(fleetNumber)
    driverMap.set(driverName, driver)

    // Station summary
    const stationData = stationMap.get(station) || {
      fills: 0, litres: 0, cost_zar: 0, cost_usd: 0, fleets: new Set()
    }
    stationData.fills += 1
    stationData.litres += litres
    if (currency === 'USD') stationData.cost_usd += cost
    else stationData.cost_zar += cost
    if (fleetNumber) stationData.fleets.add(fleetNumber)
    stationMap.set(station, stationData)

    // Weekly summary
    if (record.date) {
      const date = new Date(record.date)
      const weekNum = getISOWeek(date)
      const year = getISOWeekYear(date)
      const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`

      const week = weeklyMap.get(weekKey) || {
        week: weekNum, year, fills: 0, litres: 0, km: 0, cost_zar: 0, cost_usd: 0
      }
      week.fills += 1
      week.litres += litres
      week.km += km
      if (currency === 'USD') week.cost_usd += cost
      else week.cost_zar += cost
      weeklyMap.set(weekKey, week)

      // Monthly summary
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      const month = monthlyMap.get(monthKey) || {
        month: monthNames[date.getMonth()], year: date.getFullYear(), fills: 0, litres: 0, km: 0, cost_zar: 0, cost_usd: 0
      }
      month.fills += 1
      month.litres += litres
      month.km += km
      if (currency === 'USD') month.cost_usd += cost
      else month.cost_zar += cost
      monthlyMap.set(monthKey, month)
    }
  })

  // Prepare sheet data

  // Diesel Summary sheet
  const avgKmPerLitre = totalLitres > 0 ? (totalKm / totalLitres).toFixed(2) : '0'
  const avgCostPerLitreZAR = totalLitres > 0 && totalCostZAR > 0 ? (totalCostZAR / totalLitres).toFixed(2) : 'N/A'

  const summaryData = [
    ['Diesel Consumption Report'],
    ['Period', period],
    ['Generated', new Date().toISOString()],
    [''],
    ['Overall Statistics'],
    ['Total Records', records.length],
    ['Total Litres Filled', totalLitres.toFixed(2)],
    ['Total Distance (km)', totalKm.toFixed(0)],
    ['Average km/L', avgKmPerLitre],
    [''],
    ['Financial Summary'],
    ['Total Cost (ZAR)', totalCostZAR.toFixed(2)],
    ['Total Cost (USD)', totalCostUSD.toFixed(2)],
    ['Avg Cost/Litre (ZAR)', avgCostPerLitreZAR],
    [''],
    ['Debrief Status'],
    ['Pending Debriefs', totalPendingDebriefs],
    ['Completed Debriefs', totalCompletedDebriefs],
    [''],
    ['Unique Trucks', fleetMap.size],
    ['Unique Drivers', driverMap.size],
    ['Unique Stations', stationMap.size],
  ]

  // Diesel by Fleet sheet
  const fleetData = [
    ['Fleet', 'Fill Count', 'Litres', 'Distance (km)', 'km/L', 'Cost (ZAR)', 'Cost (USD)', 'Pending Debriefs'],
    ...Array.from(fleetMap.entries())
      .sort((a, b) => b[1].litres - a[1].litres)
      .map(([fleet, d]) => [
        fleet,
        d.fills,
        d.litres.toFixed(2),
        d.km.toFixed(0),
        d.litres > 0 ? (d.km / d.litres).toFixed(2) : 'N/A',
        d.cost_zar.toFixed(2),
        d.cost_usd.toFixed(2),
        d.pending_debriefs
      ])
  ]

  // Diesel by Driver sheet
  const driverData = [
    ['Driver', 'Fill Count', 'Litres', 'Distance (km)', 'km/L', 'Cost (ZAR)', 'Cost (USD)', 'Fleets Used'],
    ...Array.from(driverMap.entries())
      .sort((a, b) => b[1].litres - a[1].litres)
      .map(([driver, d]) => [
        driver,
        d.fills,
        d.litres.toFixed(2),
        d.km.toFixed(0),
        d.litres > 0 ? (d.km / d.litres).toFixed(2) : 'N/A',
        d.cost_zar.toFixed(2),
        d.cost_usd.toFixed(2),
        Array.from(d.fleets).join(', ')
      ])
  ]

  // Diesel by Station sheet
  const stationData = [
    ['Station', 'Fill Count', 'Litres', 'Cost (ZAR)', 'Cost (USD)', 'Avg Cost/L (ZAR)', 'Fleets Served'],
    ...Array.from(stationMap.entries())
      .sort((a, b) => b[1].litres - a[1].litres)
      .map(([station, d]) => [
        station,
        d.fills,
        d.litres.toFixed(2),
        d.cost_zar.toFixed(2),
        d.cost_usd.toFixed(2),
        d.litres > 0 && d.cost_zar > 0 ? (d.cost_zar / d.litres).toFixed(2) : 'N/A',
        Array.from(d.fleets).join(', ')
      ])
  ]

  // Diesel Weekly sheet
  const weeklyData = [
    ['Week', 'Year', 'Fill Count', 'Litres', 'Distance (km)', 'km/L', 'Cost (ZAR)', 'Cost (USD)'],
    ...Array.from(weeklyMap.values())
      .sort((a, b) => `${b.year}-${b.week}`.localeCompare(`${a.year}-${a.week}`))
      .map(d => [
        d.week,
        d.year,
        d.fills,
        d.litres.toFixed(2),
        d.km.toFixed(0),
        d.litres > 0 ? (d.km / d.litres).toFixed(2) : 'N/A',
        d.cost_zar.toFixed(2),
        d.cost_usd.toFixed(2)
      ])
  ]

  // Diesel Monthly sheet
  const monthlyData = [
    ['Month', 'Year', 'Fill Count', 'Litres', 'Distance (km)', 'km/L', 'Cost (ZAR)', 'Cost (USD)'],
    ...Array.from(monthlyMap.values())
      .sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`))
      .map(d => [
        d.month,
        d.year,
        d.fills,
        d.litres.toFixed(2),
        d.km.toFixed(0),
        d.litres > 0 ? (d.km / d.litres).toFixed(2) : 'N/A',
        d.cost_zar.toFixed(2),
        d.cost_usd.toFixed(2)
      ])
  ]

  // Diesel Transactions (raw data) sheet
  const transactionsData = [
    ['Date', 'Fleet', 'Driver', 'Station', 'Litres', 'Cost', 'Currency', 'KM Reading', 'Distance', 'km/L', 'Debrief Status'],
    ...records.slice(0, 1000).map((r: any) => [
      r.date,
      r.fleet_number,
      r.driver_name || '',
      r.fuel_station,
      r.litres_filled,
      r.total_cost,
      r.currency || 'ZAR',
      r.km_reading,
      r.distance_travelled || '',
      r.km_per_litre ? r.km_per_litre.toFixed(2) : '',
      r.debrief_signed ? 'Completed' : (r.requires_debrief ? 'Pending' : 'N/A')
    ])
  ]

  // --- REEFER REPORTS ---
  // Aggregate reefer data
  const reeferFleetMap = new Map<string, any>()
  const reeferDriverMap = new Map<string, any>()
  const reeferStationMap = new Map<string, any>()
  const reeferWeeklyMap = new Map<string, any>()
  const reeferMonthlyMap = new Map<string, any>()
  let reeferTotalLitres = 0
  let reeferTotalCostZAR = 0
  let reeferTotalCostUSD = 0
  let reeferTotalHours = 0

  mergedReeferRecords.forEach((record: any) => {
    // Records from reefer_diesel_records use reefer_unit; legacy use fleet_number
    const reeferUnit = (record.reefer_unit || record.fleet_number || '').toUpperCase().trim()
    const litres = record.litres_filled || 0
    const cost = record.total_cost || 0
    const currency = record.currency || 'ZAR'
    const driverName = record.driver_name || 'Unknown'
    const station = record.fuel_station || 'Unknown'

    // For legacy diesel_records, km_reading was actually operating_hours
    const opHours = record.operating_hours ?? record.km_reading ?? null
    const prevHours = record.previous_operating_hours ?? record.previous_km_reading ?? null
    const hoursOp = record.hours_operated ?? (
      (opHours != null && prevHours != null && opHours > prevHours) ? opHours - prevHours : (record.distance_travelled ?? null)
    )
    const lph = record.litres_per_hour ?? (
      (hoursOp && hoursOp > 0 && litres > 0) ? litres / hoursOp : null
    )

    reeferTotalLitres += litres
    if (currency === 'USD') reeferTotalCostUSD += cost
    else reeferTotalCostZAR += cost
    if (hoursOp && hoursOp > 0) reeferTotalHours += hoursOp

    // Fleet aggregation
    if (reeferUnit) {
      const fleet = reeferFleetMap.get(reeferUnit) || {
        fills: 0, litres: 0, cost_zar: 0, cost_usd: 0, total_hours: 0, lph_sum: 0, lph_count: 0
      }
      fleet.fills += 1
      fleet.litres += litres
      if (currency === 'USD') fleet.cost_usd += cost
      else fleet.cost_zar += cost
      if (hoursOp && hoursOp > 0) fleet.total_hours += hoursOp
      if (lph && lph > 0) { fleet.lph_sum += lph; fleet.lph_count += 1 }
      reeferFleetMap.set(reeferUnit, fleet)
    }

    // Driver aggregation
    const driver = reeferDriverMap.get(driverName) || {
      fills: 0, litres: 0, cost_zar: 0, cost_usd: 0, total_hours: 0, lph_sum: 0, lph_count: 0, fleets: new Set()
    }
    driver.fills += 1
    driver.litres += litres
    if (currency === 'USD') driver.cost_usd += cost
    else driver.cost_zar += cost
    if (hoursOp && hoursOp > 0) driver.total_hours += hoursOp
    if (lph && lph > 0) { driver.lph_sum += lph; driver.lph_count += 1 }
    if (reeferUnit) driver.fleets.add(reeferUnit)
    reeferDriverMap.set(driverName, driver)

    // Station aggregation
    const stData = reeferStationMap.get(station) || {
      fills: 0, litres: 0, cost_zar: 0, cost_usd: 0, total_hours: 0, lph_sum: 0, lph_count: 0, fleets: new Set()
    }
    stData.fills += 1
    stData.litres += litres
    if (currency === 'USD') stData.cost_usd += cost
    else stData.cost_zar += cost
    if (hoursOp && hoursOp > 0) stData.total_hours += hoursOp
    if (lph && lph > 0) { stData.lph_sum += lph; stData.lph_count += 1 }
    if (reeferUnit) stData.fleets.add(reeferUnit)
    reeferStationMap.set(station, stData)

    // Reefer weekly aggregation
    if (record.date) {
      const date = new Date(record.date)
      const weekNum = getISOWeek(date)
      const year = getISOWeekYear(date)
      const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`

      const week = reeferWeeklyMap.get(weekKey) || {
        week: weekNum, year, fills: 0, litres: 0, total_hours: 0, cost_zar: 0, cost_usd: 0
      }
      week.fills += 1
      week.litres += litres
      if (hoursOp && hoursOp > 0) week.total_hours += hoursOp
      if (currency === 'USD') week.cost_usd += cost
      else week.cost_zar += cost
      reeferWeeklyMap.set(weekKey, week)

      // Reefer monthly aggregation
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const month = reeferMonthlyMap.get(monthKey) || {
        month: monthNames[date.getMonth()], year: date.getFullYear(), fills: 0, litres: 0, total_hours: 0, cost_zar: 0, cost_usd: 0
      }
      month.fills += 1
      month.litres += litres
      if (hoursOp && hoursOp > 0) month.total_hours += hoursOp
      if (currency === 'USD') month.cost_usd += cost
      else month.cost_zar += cost
      reeferMonthlyMap.set(monthKey, month)
    }
  })

  // Reefer Summary sheet
  const avgLph = reeferTotalHours > 0 ? (reeferTotalLitres / reeferTotalHours).toFixed(2) : 'N/A'
  const reeferSummaryData = [
    ['Reefer Diesel Report (L/hr)'],
    ['Period', period],
    ['Generated', new Date().toISOString()],
    [''],
    ['Overall Statistics'],
    ['Total Reefer Fill Records', mergedReeferRecords.length],
    ['Total Litres Filled', reeferTotalLitres.toFixed(2)],
    ['Total Hours Operated', reeferTotalHours.toFixed(1)],
    ['Average L/hr', avgLph],
    [''],
    ['Financial Summary'],
    ['Total Cost (ZAR)', reeferTotalCostZAR.toFixed(2)],
    ['Total Cost (USD)', reeferTotalCostUSD.toFixed(2)],
    [''],
    ['Unique Reefer Units', reeferFleetMap.size],
    ['Unique Drivers', reeferDriverMap.size],
    ['Unique Stations', reeferStationMap.size],
  ]

  // Reefer by Fleet sheet
  const reeferFleetData = [
    ['Reefer Unit', 'Fill Count', 'Litres', 'Hours Operated', 'Avg L/hr', 'Cost (ZAR)', 'Cost (USD)'],
    ...Array.from(reeferFleetMap.entries())
      .sort((a, b) => b[1].litres - a[1].litres)
      .map(([fleet, d]) => [
        fleet,
        d.fills,
        d.litres.toFixed(2),
        d.total_hours.toFixed(1),
        d.lph_count > 0 ? (d.lph_sum / d.lph_count).toFixed(2) : 'N/A',
        d.cost_zar.toFixed(2),
        d.cost_usd.toFixed(2),
      ])
  ]

  // Reefer by Driver sheet
  const reeferDriverData = [
    ['Driver', 'Fill Count', 'Litres', 'Hours Operated', 'Avg L/hr', 'Cost (ZAR)', 'Cost (USD)', 'Reefer Units'],
    ...Array.from(reeferDriverMap.entries())
      .sort((a, b) => b[1].litres - a[1].litres)
      .map(([driver, d]) => [
        driver,
        d.fills,
        d.litres.toFixed(2),
        d.total_hours.toFixed(1),
        d.lph_count > 0 ? (d.lph_sum / d.lph_count).toFixed(2) : 'N/A',
        d.cost_zar.toFixed(2),
        d.cost_usd.toFixed(2),
        Array.from(d.fleets).join(', ')
      ])
  ]

  // Reefer by Station sheet
  const reeferStationData = [
    ['Station', 'Fill Count', 'Litres', 'Hours Operated', 'Avg L/hr', 'Cost (ZAR)', 'Cost (USD)', 'Avg Cost/L (ZAR)', 'Reefer Units'],
    ...Array.from(reeferStationMap.entries())
      .sort((a, b) => b[1].litres - a[1].litres)
      .map(([station, d]) => [
        station,
        d.fills,
        d.litres.toFixed(2),
        d.total_hours.toFixed(1),
        d.lph_count > 0 ? (d.lph_sum / d.lph_count).toFixed(2) : 'N/A',
        d.cost_zar.toFixed(2),
        d.cost_usd.toFixed(2),
        d.litres > 0 && d.cost_zar > 0 ? (d.cost_zar / d.litres).toFixed(2) : 'N/A',
        Array.from(d.fleets).join(', ')
      ])
  ]

  // Reefer Transactions (raw data) sheet
  const reeferTransactionsData = [
    ['Date', 'Reefer Unit', 'Driver', 'Station', 'Litres', 'Cost', 'Currency', 'Cost/L', 'Op Hours', 'Prev Hours', 'Hours Operated', 'L/hr', 'Linked Horse', 'Notes'],
    ...mergedReeferRecords.slice(0, 1000).map((r: any) => {
      const opH = r.operating_hours ?? r.km_reading ?? ''
      const prevH = r.previous_operating_hours ?? r.previous_km_reading ?? ''
      const hrsOp = r.hours_operated ?? (
        (opH && prevH && Number(opH) > Number(prevH)) ? (Number(opH) - Number(prevH)).toFixed(1) : ''
      )
      const computedLph = r.litres_per_hour ?? (
        (hrsOp && Number(hrsOp) > 0 && r.litres_filled > 0) ? (r.litres_filled / Number(hrsOp)).toFixed(2) : ''
      )
      const costPerL = r.cost_per_litre ?? (
        (r.litres_filled > 0 && r.total_cost > 0) ? (r.total_cost / r.litres_filled).toFixed(2) : ''
      )
      return [
        r.date,
        r.reefer_unit || r.fleet_number || '',
        r.driver_name || '',
        r.fuel_station || '',
        r.litres_filled || 0,
        r.total_cost || 0,
        r.currency || 'ZAR',
        costPerL,
        opH,
        prevH,
        hrsOp,
        computedLph,
        r.linked_horse || '',
        r.notes || ''
      ]
    })
  ]

  // Reefer Weekly sheet
  const reeferWeeklyData = [
    ['Week', 'Year', 'Fill Count', 'Litres', 'Hours Operated', 'L/hr', 'Cost (ZAR)', 'Cost (USD)'],
    ...Array.from(reeferWeeklyMap.values())
      .sort((a, b) => `${b.year}-${b.week}`.localeCompare(`${a.year}-${a.week}`))
      .map(d => [
        d.week,
        d.year,
        d.fills,
        d.litres.toFixed(2),
        d.total_hours.toFixed(1),
        d.total_hours > 0 ? (d.litres / d.total_hours).toFixed(2) : 'N/A',
        d.cost_zar.toFixed(2),
        d.cost_usd.toFixed(2)
      ])
  ]

  // Reefer Monthly sheet
  const reeferMonthlyData = [
    ['Month', 'Year', 'Fill Count', 'Litres', 'Hours Operated', 'L/hr', 'Cost (ZAR)', 'Cost (USD)'],
    ...Array.from(reeferMonthlyMap.values())
      .sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`))
      .map(d => [
        d.month,
        d.year,
        d.fills,
        d.litres.toFixed(2),
        d.total_hours.toFixed(1),
        d.total_hours > 0 ? (d.litres / d.total_hours).toFixed(2) : 'N/A',
        d.cost_zar.toFixed(2),
        d.cost_usd.toFixed(2)
      ])
  ]

  // Update each diesel sheet
  await updateSheet(accessToken, spreadsheetId, 'Diesel Summary', summaryData)
  await updateSheet(accessToken, spreadsheetId, 'Diesel by Fleet', fleetData)
  await updateSheet(accessToken, spreadsheetId, 'Diesel by Driver', driverData)
  await updateSheet(accessToken, spreadsheetId, 'Diesel by Station', stationData)
  await updateSheet(accessToken, spreadsheetId, 'Diesel Weekly', weeklyData)
  await updateSheet(accessToken, spreadsheetId, 'Diesel Monthly', monthlyData)
  await updateSheet(accessToken, spreadsheetId, 'Diesel Transactions', transactionsData)

  // Update reefer sheets
  await updateSheet(accessToken, spreadsheetId, 'Reefer Summary', reeferSummaryData)
  await updateSheet(accessToken, spreadsheetId, 'Reefer by Fleet', reeferFleetData)
  await updateSheet(accessToken, spreadsheetId, 'Reefer by Driver', reeferDriverData)
  await updateSheet(accessToken, spreadsheetId, 'Reefer by Station', reeferStationData)
  await updateSheet(accessToken, spreadsheetId, 'Reefer Weekly', reeferWeeklyData)
  await updateSheet(accessToken, spreadsheetId, 'Reefer Monthly', reeferMonthlyData)
  await updateSheet(accessToken, spreadsheetId, 'Reefer Transactions', reeferTransactionsData)

  const allSheets = [
    'Diesel Summary', 'Diesel by Fleet', 'Diesel by Driver', 'Diesel by Station', 'Diesel Weekly', 'Diesel Monthly', 'Diesel Transactions',
    'Reefer Summary', 'Reefer by Fleet', 'Reefer by Driver', 'Reefer by Station', 'Reefer Weekly', 'Reefer Monthly', 'Reefer Transactions'
  ]

  return new Response(JSON.stringify({
    success: true,
    message: 'Diesel & Reefer reports synced to Google Sheet successfully',
    updated_at: new Date().toISOString(),
    period: period,
    records_processed: records.length,
    reefer_records_processed: mergedReeferRecords.length,
    sheets_updated: allSheets,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Sync Tyre Reports to Google Sheets
async function syncTyreReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string
): Promise<Response> {
  // Fetch all tyres with vehicle info
  const { data: tyres, error: tyresError } = await supabase
    .from('tyres')
    .select('*')
    .order('created_at', { ascending: false })

  if (tyresError) throw new Error(`Failed to fetch tyres: ${tyresError.message}`)

  // Fetch tyre inventory
  const { data: inventory, error: invError } = await supabase
    .from('tyre_inventory')
    .select('*')
    .order('brand')

  if (invError) throw new Error(`Failed to fetch tyre inventory: ${invError.message}`)

  const tyreRecords = tyres || []
  const inventoryRecords = inventory || []

  // Build aggregations
  const conditionMap = new Map<string, number>()
  const brandMap = new Map<string, { count: number; total_km: number; avg_tread: number; tread_count: number; cost_zar: number; cost_usd: number }>()
  const sizeMap = new Map<string, number>()
  const positionMap = new Map<string, number>()
  const totalTyres = tyreRecords.length
  let totalKm = 0
  let totalCostZAR = 0
  let totalCostUSD = 0
  let installedCount = 0
  let removedCount = 0

  tyreRecords.forEach((tyre: any) => {
    // Condition counts
    const condition = tyre.condition || 'Unknown'
    conditionMap.set(condition, (conditionMap.get(condition) || 0) + 1)

    // Brand aggregation
    const brand = tyre.brand || 'Unknown'
    const brandData = brandMap.get(brand) || { count: 0, total_km: 0, avg_tread: 0, tread_count: 0, cost_zar: 0, cost_usd: 0 }
    brandData.count += 1
    brandData.total_km += tyre.km_travelled || 0
    if (tyre.current_tread_depth != null) {
      brandData.avg_tread += tyre.current_tread_depth
      brandData.tread_count += 1
    }
    brandData.cost_zar += tyre.purchase_cost_zar || 0
    brandData.cost_usd += tyre.purchase_cost_usd || 0
    brandMap.set(brand, brandData)

    // Size counts
    const size = tyre.size || 'Unknown'
    sizeMap.set(size, (sizeMap.get(size) || 0) + 1)

    // Position counts
    const position = tyre.current_fleet_position || tyre.position || 'Unassigned'
    positionMap.set(position, (positionMap.get(position) || 0) + 1)

    // Totals
    totalKm += tyre.km_travelled || 0
    totalCostZAR += tyre.purchase_cost_zar || 0
    totalCostUSD += tyre.purchase_cost_usd || 0
    if (tyre.installation_date && !tyre.removal_date) installedCount++
    if (tyre.removal_date) removedCount++
  })

  // Tyre Summary sheet
  const summaryData = [
    ['Tyre Management Report'],
    ['Generated', new Date().toISOString()],
    [''],
    ['Overall Statistics'],
    ['Total Tyres Tracked', totalTyres],
    ['Currently Installed', installedCount],
    ['Removed / In Stock', removedCount],
    ['Total KM Travelled (all tyres)', totalKm.toFixed(0)],
    [''],
    ['Financial Summary'],
    ['Total Purchase Cost (ZAR)', totalCostZAR.toFixed(2)],
    ['Total Purchase Cost (USD)', totalCostUSD.toFixed(2)],
    ['Average Cost/Tyre (ZAR)', totalTyres > 0 ? (totalCostZAR / totalTyres).toFixed(2) : '0'],
    [''],
    ['Condition Breakdown'],
    ...Array.from(conditionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([condition, count]) => [condition, count]),
    [''],
    ['Unique Brands', brandMap.size],
    ['Unique Sizes', sizeMap.size],
  ]

  // Tyre by Brand sheet
  const brandData = [
    ['Brand', 'Count', 'Total KM', 'Avg KM/Tyre', 'Avg Tread Depth', 'Cost (ZAR)', 'Cost (USD)', 'Cost/KM (ZAR)'],
    ...Array.from(brandMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([brand, d]) => [
        brand,
        d.count,
        d.total_km.toFixed(0),
        d.count > 0 ? (d.total_km / d.count).toFixed(0) : '0',
        d.tread_count > 0 ? (d.avg_tread / d.tread_count).toFixed(1) : 'N/A',
        d.cost_zar.toFixed(2),
        d.cost_usd.toFixed(2),
        d.total_km > 0 ? (d.cost_zar / d.total_km).toFixed(4) : 'N/A',
      ])
  ]

  // Tyre by Size sheet
  const sizeData = [
    ['Size', 'Count', '% of Total'],
    ...Array.from(sizeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([size, count]) => [
        size,
        count,
        totalTyres > 0 ? (count / totalTyres * 100).toFixed(1) + '%' : '0%',
      ])
  ]

  // Tyre by Position sheet
  const positionData = [
    ['Position', 'Count'],
    ...Array.from(positionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([pos, count]) => [pos, count])
  ]

  // Tyre Inventory sheet
  const inventoryData = [
    ['Brand', 'Model', 'Size', 'Type', 'Quantity', 'Min Quantity', 'Reorder Needed', 'Unit Price (ZAR)', 'Unit Price (USD)', 'Supplier', 'Vendor', 'Location', 'Status'],
    ...inventoryRecords.map((inv: any) => [
      inv.brand || '',
      inv.model || '',
      inv.size || '',
      inv.type || '',
      inv.quantity || 0,
      inv.min_quantity || 0,
      (inv.quantity || 0) <= (inv.min_quantity || 0) ? 'YES' : 'No',
      inv.purchase_cost_zar || inv.unit_price || '',
      inv.purchase_cost_usd || '',
      inv.supplier || '',
      inv.vendor || '',
      inv.location || '',
      inv.status || '',
    ])
  ]

  // Tyre Details (raw data) sheet - limit to 1000
  const detailsData = [
    ['Serial Number', 'Brand', 'Model', 'Size', 'Type', 'Condition', 'Position', 'Fleet Position', 'Current Tread', 'Initial Tread', 'KM Travelled', 'Install Date', 'Removal Date', 'Removal Reason', 'Cost (ZAR)', 'Cost (USD)', 'Notes'],
    ...tyreRecords.slice(0, 1000).map((t: any) => [
      t.serial_number || '',
      t.brand || '',
      t.model || '',
      t.size || '',
      t.type || '',
      t.condition || '',
      t.position || '',
      t.current_fleet_position || '',
      t.current_tread_depth != null ? t.current_tread_depth : '',
      t.initial_tread_depth != null ? t.initial_tread_depth : '',
      t.km_travelled || 0,
      t.installation_date || '',
      t.removal_date || '',
      t.removal_reason || '',
      t.purchase_cost_zar || '',
      t.purchase_cost_usd || '',
      t.notes || '',
    ])
  ]

  // Update sheets
  await updateSheet(accessToken, spreadsheetId, 'Tyre Summary', summaryData)
  await updateSheet(accessToken, spreadsheetId, 'Tyres by Brand', brandData)
  await updateSheet(accessToken, spreadsheetId, 'Tyres by Size', sizeData)
  await updateSheet(accessToken, spreadsheetId, 'Tyres by Position', positionData)
  await updateSheet(accessToken, spreadsheetId, 'Tyre Inventory', inventoryData)
  await updateSheet(accessToken, spreadsheetId, 'Tyre Details', detailsData)

  return new Response(JSON.stringify({
    success: true,
    message: 'Tyre reports synced to Google Sheet successfully',
    updated_at: new Date().toISOString(),
    tyres_processed: tyreRecords.length,
    inventory_items: inventoryRecords.length,
    sheets_updated: ['Tyre Summary', 'Tyres by Brand', 'Tyres by Size', 'Tyres by Position', 'Tyre Inventory', 'Tyre Details'],
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

// Sync Workshop (Job Cards) Reports to Google Sheets
async function syncWorkshopReports(
  supabase: any,
  accessToken: string,
  spreadsheetId: string,
  startDate: Date | null,
  period: string
): Promise<Response> {
  // Fetch job cards
  let jobCardsQuery = supabase
    .from('job_cards')
    .select('*')
    .order('created_at', { ascending: false })

  if (startDate) {
    jobCardsQuery = jobCardsQuery.gte('created_at', startDate.toISOString())
  }

  const { data: jobCards, error: jcError } = await jobCardsQuery
  if (jcError) throw new Error(`Failed to fetch job cards: ${jcError.message}`)

  const jobCardRecords = jobCards || []

  // Fetch vehicle info for fleet numbers
  const vehicleIds = [...new Set(jobCardRecords.map((jc: any) => jc.vehicle_id).filter(Boolean))]
  const vehicleMap2 = new Map<string, any>()
  if (vehicleIds.length > 0) {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, fleet_number, registration_number')
      .in('id', vehicleIds)
    ;(vehicles || []).forEach((v: any) => vehicleMap2.set(v.id, v))
  }

  const jobCardIds = jobCardRecords.map((jc: any) => jc.id)

  // Fetch labor entries for these job cards
  let laborEntries: any[] = []
  if (jobCardIds.length > 0) {
    const { data: labor } = await supabase
      .from('labor_entries')
      .select('*')
      .in('job_card_id', jobCardIds)
    laborEntries = labor || []
  }

  // Fetch parts requests for these job cards
  let partsRequests: any[] = []
  if (jobCardIds.length > 0) {
    const { data: parts } = await supabase
      .from('parts_requests')
      .select('*')
      .in('job_card_id', jobCardIds)
    partsRequests = parts || []
  }

  // Fetch job card notes
  let jobCardNotes: any[] = []
  if (jobCardIds.length > 0) {
    const { data: notes } = await supabase
      .from('job_card_notes')
      .select('*')
      .in('job_card_id', jobCardIds)
    jobCardNotes = notes || []
  }

  // Build aggregations
  const statusMap = new Map<string, number>()
  const priorityMap = new Map<string, number>()
  const assigneeMap = new Map<string, { cards: number; labor_hours: number; labor_cost: number; parts_count: number; parts_cost: number }>()
  const vehicleMap = new Map<string, { cards: number; labor_cost: number; parts_cost: number }>()
const monthlyMap = new Map<string, { month: string; year: number; cards: number; labor_hours: number; labor_cost: number; parts_cost: number }>()

  let totalLaborHours = 0
  let totalLaborCost = 0
  let totalPartsCost = 0
  let totalPartsQty = 0

  // Labor by job card
  const laborByJC = new Map<string, { hours: number; cost: number }>()
  laborEntries.forEach((le: any) => {
    const jcId = le.job_card_id
    const entry = laborByJC.get(jcId) || { hours: 0, cost: 0 }
    entry.hours += le.hours_worked || 0
    entry.cost += le.total_cost || 0
    laborByJC.set(jcId, entry)
    totalLaborHours += le.hours_worked || 0
    totalLaborCost += le.total_cost || 0
  })

  // Parts by job card
  const partsByJC = new Map<string, { count: number; cost: number }>()
  partsRequests.forEach((pr: any) => {
    const jcId = pr.job_card_id
    const entry = partsByJC.get(jcId) || { count: 0, cost: 0 }
    entry.count += pr.quantity || 0
    entry.cost += pr.total_price || (pr.unit_price || 0) * (pr.quantity || 0)
    partsByJC.set(jcId, entry)
    totalPartsQty += pr.quantity || 0
    totalPartsCost += pr.total_price || (pr.unit_price || 0) * (pr.quantity || 0)
  })

  // Notes count by job card
  const notesByJC = new Map<string, number>()
  jobCardNotes.forEach((n: any) => {
    notesByJC.set(n.job_card_id, (notesByJC.get(n.job_card_id) || 0) + 1)
  })

  jobCardRecords.forEach((jc: any) => {
    const status = jc.status || 'Unknown'
    statusMap.set(status, (statusMap.get(status) || 0) + 1)

    const priority = jc.priority || 'Unknown'
    priorityMap.set(priority, (priorityMap.get(priority) || 0) + 1)

    const assignee = jc.assignee || 'Unassigned'
    const assigneeData = assigneeMap.get(assignee) || { cards: 0, labor_hours: 0, labor_cost: 0, parts_count: 0, parts_cost: 0 }
    assigneeData.cards += 1
    const jcLabor = laborByJC.get(jc.id)
    if (jcLabor) {
      assigneeData.labor_hours += jcLabor.hours
      assigneeData.labor_cost += jcLabor.cost
    }
    const jcParts = partsByJC.get(jc.id)
    if (jcParts) {
      assigneeData.parts_count += jcParts.count
      assigneeData.parts_cost += jcParts.cost
    }
    assigneeMap.set(assignee, assigneeData)

    // Vehicle aggregation
    const vehicleInfo = vehicleMap2.get(jc.vehicle_id)
    const fleet = vehicleInfo?.fleet_number || 'No Vehicle'
    const vehicleData = vehicleMap.get(fleet) || { cards: 0, labor_cost: 0, parts_cost: 0 }
    vehicleData.cards += 1
    if (jcLabor) vehicleData.labor_cost += jcLabor.cost
    if (jcParts) vehicleData.parts_cost += jcParts.cost
    vehicleMap.set(fleet, vehicleData)

    // Monthly
    if (jc.created_at) {
      const date = new Date(jc.created_at)
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const month = monthlyMap.get(monthKey) || { month: monthNames[date.getMonth()], year: date.getFullYear(), cards: 0, labor_hours: 0, labor_cost: 0, parts_cost: 0 }
      month.cards += 1
      if (jcLabor) {
        month.labor_hours += jcLabor.hours
        month.labor_cost += jcLabor.cost
      }
      if (jcParts) month.parts_cost += jcParts.cost
      monthlyMap.set(monthKey, month)
    }
  })

  // Workshop Summary sheet
  const totalMaintenanceCost = totalLaborCost + totalPartsCost
  const summaryData = [
    ['Workshop Management Report'],
    ['Period', period],
    ['Generated', new Date().toISOString()],
    [''],
    ['Overall Statistics'],
    ['Total Job Cards', jobCardRecords.length],
    ['Total Labor Hours', totalLaborHours.toFixed(1)],
    ['Total Parts Requested', totalPartsQty],
    [''],
    ['Financial Summary'],
    ['Total Labor Cost', totalLaborCost.toFixed(2)],
    ['Total Parts Cost', totalPartsCost.toFixed(2)],
    ['Total Maintenance Cost', totalMaintenanceCost.toFixed(2)],
    ['Avg Cost per Job Card', jobCardRecords.length > 0 ? (totalMaintenanceCost / jobCardRecords.length).toFixed(2) : '0'],
    [''],
    ['Status Breakdown'],
    ...Array.from(statusMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => [status, count]),
    [''],
    ['Priority Breakdown'],
    ...Array.from(priorityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([priority, count]) => [priority, count]),
    [''],
    ['Unique Technicians/Assignees', assigneeMap.size],
    ['Unique Vehicles Serviced', vehicleMap.size],
  ]

  // Workshop by Assignee sheet
  const assigneeData = [
    ['Assignee', 'Job Cards', 'Labor Hours', 'Labor Cost', 'Parts Count', 'Parts Cost', 'Total Cost'],
    ...Array.from(assigneeMap.entries())
      .sort((a, b) => b[1].cards - a[1].cards)
      .map(([name, d]) => [
        name,
        d.cards,
        d.labor_hours.toFixed(1),
        d.labor_cost.toFixed(2),
        d.parts_count,
        d.parts_cost.toFixed(2),
        (d.labor_cost + d.parts_cost).toFixed(2),
      ])
  ]

  // Workshop by Vehicle sheet
  const vehicleData = [
    ['Fleet Number', 'Job Cards', 'Labor Cost', 'Parts Cost', 'Total Cost', 'Avg Cost/Card'],
    ...Array.from(vehicleMap.entries())
      .sort((a, b) => (b[1].labor_cost + b[1].parts_cost) - (a[1].labor_cost + a[1].parts_cost))
      .map(([fleet, d]) => [
        fleet,
        d.cards,
        d.labor_cost.toFixed(2),
        d.parts_cost.toFixed(2),
        (d.labor_cost + d.parts_cost).toFixed(2),
        d.cards > 0 ? ((d.labor_cost + d.parts_cost) / d.cards).toFixed(2) : '0',
      ])
  ]

  // Workshop Monthly sheet
  const monthlyData = [
    ['Month', 'Year', 'Job Cards', 'Labor Hours', 'Labor Cost', 'Parts Cost', 'Total Cost'],
    ...Array.from(monthlyMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([_key, d]) => [
        d.month,
        d.year,
        d.cards,
        d.labor_hours.toFixed(1),
        d.labor_cost.toFixed(2),
        d.parts_cost.toFixed(2),
        (d.labor_cost + d.parts_cost).toFixed(2),
      ])
  ]

  // Workshop Job Cards Detail sheet (raw data)
  const detailsData = [
    ['Job Number', 'Title', 'Status', 'Priority', 'Assignee', 'Fleet Number', 'Odometer', 'Due Date', 'Created', 'Labor Hours', 'Labor Cost', 'Parts Qty', 'Parts Cost', 'Total Cost', 'Notes Count'],
    ...jobCardRecords.slice(0, 1000).map((jc: any) => {
      const labor = laborByJC.get(jc.id) || { hours: 0, cost: 0 }
      const parts = partsByJC.get(jc.id) || { count: 0, cost: 0 }
      const notesCount = notesByJC.get(jc.id) || 0
      return [
        jc.job_number || '',
        jc.title || '',
        jc.status || '',
        jc.priority || '',
        jc.assignee || '',
        vehicleMap2.get(jc.vehicle_id)?.fleet_number || '',
        jc.odometer_reading || '',
        jc.due_date || '',
        jc.created_at ? new Date(jc.created_at).toISOString().split('T')[0] : '',
        labor.hours.toFixed(1),
        labor.cost.toFixed(2),
        parts.count,
        parts.cost.toFixed(2),
        (labor.cost + parts.cost).toFixed(2),
        notesCount,
      ]
    })
  ]

  // Parts Requests Detail sheet
  const partsDetailData = [
    ['Part Name', 'Part Number', 'Brand', 'Quantity', 'Unit Price', 'Total Price', 'Status', 'Job Card', 'Requested By', 'IR Number', 'Is Service', 'Vendor', 'Expected Delivery', 'Received Qty', 'Received Date'],
    ...partsRequests.slice(0, 1000).map((pr: any) => {
      const jc = jobCardRecords.find((j: any) => j.id === pr.job_card_id)
      return [
        pr.part_name || '',
        pr.part_number || '',
        pr.make_brand || '',
        pr.quantity || 0,
        pr.unit_price || '',
        pr.total_price || '',
        pr.status || '',
        jc?.job_number || '',
        pr.requested_by || '',
        pr.ir_number || '',
        pr.is_service ? 'Yes' : 'No',
        pr.vendor_id || '',
        pr.expected_delivery_date || '',
        pr.received_quantity || '',
        pr.received_date || '',
      ]
    })
  ]

  // Update sheets
  await updateSheet(accessToken, spreadsheetId, 'Workshop Summary', summaryData)
  await updateSheet(accessToken, spreadsheetId, 'Workshop by Assignee', assigneeData)
  await updateSheet(accessToken, spreadsheetId, 'Workshop by Vehicle', vehicleData)
  await updateSheet(accessToken, spreadsheetId, 'Workshop Monthly', monthlyData)
  await updateSheet(accessToken, spreadsheetId, 'Workshop Job Cards', detailsData)
  await updateSheet(accessToken, spreadsheetId, 'Workshop Parts', partsDetailData)

  return new Response(JSON.stringify({
    success: true,
    message: 'Workshop reports synced to Google Sheet successfully',
    updated_at: new Date().toISOString(),
    period: period,
    job_cards_processed: jobCardRecords.length,
    labor_entries: laborEntries.length,
    parts_requests: partsRequests.length,
    sheets_updated: ['Workshop Summary', 'Workshop by Assignee', 'Workshop by Vehicle', 'Workshop Monthly', 'Workshop Job Cards', 'Workshop Parts'],
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get config from environment
    const spreadsheetId = Deno.env.get('GOOGLE_SHEET_ID')
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')

    if (!spreadsheetId || !serviceAccountJson) {
      throw new Error('Missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON environment variables')
    }

    // Get period and type from query params
    const url = new URL(req.url)
    const period = url.searchParams.get('period') || 'ytd'
    const syncType = url.searchParams.get('type') || 'trips' // 'trips' or 'diesel'

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Calculate date filter
    const now = new Date()
    let startDate: Date | null = null

    switch (period) {
      case '1month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        break
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        break
      case '6months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
        break
      case '1year':
        startDate = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate())
        break
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'all':
      default:
        startDate = null
    }

    // Get Google access token
    const accessToken = await getGoogleAccessToken(serviceAccountJson)

    // Handle Diesel Reports sync
    if (syncType === 'diesel') {
      return await syncDieselReports(supabase, accessToken, spreadsheetId, startDate, period)
    }

    // Handle Tyre Reports sync
    if (syncType === 'tyres') {
      return await syncTyreReports(supabase, accessToken, spreadsheetId)
    }

    // Handle Workshop (Job Cards) Reports sync
    if (syncType === 'workshop') {
      return await syncWorkshopReports(supabase, accessToken, spreadsheetId, startDate, period)
    }

    // Default: Handle Trip Reports sync
    // Fetch trips
    let tripsQuery = supabase
      .from('trips')
      .select(`
        id,
        trip_number,
        driver_name,
        client_name,
        base_revenue,
        revenue_currency,
        distance_km,
        departure_date,
        arrival_date,
        status,
        origin,
        destination,
        wialon_vehicles:vehicle_id(fleet_number),
        vehicles:fleet_vehicle_id(fleet_number)
      `)
      .order('departure_date', { ascending: false })

    if (startDate) {
      tripsQuery = tripsQuery.gte('departure_date', startDate.toISOString().split('T')[0])
    }

    const { data: tripsRaw, error: tripsError } = await tripsQuery
    if (tripsError) throw new Error(`Failed to fetch trips: ${tripsError.message}`)

    const trips = (tripsRaw || []).map((trip: any) => ({
      ...trip,
      fleet_number: trip.vehicles?.fleet_number || trip.wialon_vehicles?.fleet_number || null,
    }))

    // Fetch cost entries
    const tripIds = trips.map((t: any) => t.id)
    let costEntries: any[] = []

    if (tripIds.length > 0) {
      const { data: costs } = await supabase
        .from('cost_entries')
        .select('id, trip_id, amount, currency')
        .in('trip_id', tripIds)
      costEntries = costs || []
    }

    // Helper: Get costs by trip
    const getTripCosts = (tripId: string) => {
      const tripCosts = costEntries.filter((c: any) => c.trip_id === tripId)
      return {
        ZAR: tripCosts.filter((c: any) => (c.currency || 'ZAR') === 'ZAR').reduce((sum: number, c: any) => sum + (c.amount || 0), 0),
        USD: tripCosts.filter((c: any) => c.currency === 'USD').reduce((sum: number, c: any) => sum + (c.amount || 0), 0),
      }
    }

    // Build report data
    const clientMap = new Map<string, any>()
    const driverMap = new Map<string, any>()
    const truckMap = new Map<string, any>()
    const weeklyMap = new Map<string, any>()
    const monthlyMap = new Map<string, any>()

    let totalRevenueZAR = 0, totalRevenueUSD = 0
    let totalExpensesZAR = 0, totalExpensesUSD = 0
    let totalKm = 0

    trips.forEach((trip: any) => {
      const costs = getTripCosts(trip.id)
      const currency = (trip.revenue_currency || 'ZAR') as 'ZAR' | 'USD'
      const revenue = trip.base_revenue || 0
      const km = trip.distance_km || 0

      // Overall totals
      if (currency === 'ZAR') totalRevenueZAR += revenue
      else totalRevenueUSD += revenue
      totalExpensesZAR += costs.ZAR
      totalExpensesUSD += costs.USD
      totalKm += km

      // Client summary
      const clientName = trip.client_name || 'No Client'
      const client = clientMap.get(clientName) || { trips: 0, revenue_zar: 0, revenue_usd: 0, expenses_zar: 0, expenses_usd: 0 }
      client.trips += 1
      if (currency === 'ZAR') client.revenue_zar += revenue; else client.revenue_usd += revenue
      client.expenses_zar += costs.ZAR
      client.expenses_usd += costs.USD
      clientMap.set(clientName, client)

      // Driver summary
      const driverName = trip.driver_name || 'Unassigned'
      const driver = driverMap.get(driverName) || { trips: 0, km: 0, revenue_zar: 0, revenue_usd: 0, expenses_zar: 0, expenses_usd: 0 }
      driver.trips += 1
      driver.km += km
      if (currency === 'ZAR') driver.revenue_zar += revenue; else driver.revenue_usd += revenue
      driver.expenses_zar += costs.ZAR
      driver.expenses_usd += costs.USD
      driverMap.set(driverName, driver)

      // Truck summary - grouped by fleet number only
      const fleetNumber = (trip.fleet_number || '').toUpperCase().trim()
      if (fleetNumber) {
        const truck = truckMap.get(fleetNumber) || { trips: 0, km: 0, revenue_zar: 0, revenue_usd: 0, expenses_zar: 0, expenses_usd: 0 }
        truck.trips += 1
        truck.km += km
        if (currency === 'ZAR') truck.revenue_zar += revenue; else truck.revenue_usd += revenue
        truck.expenses_zar += costs.ZAR
        truck.expenses_usd += costs.USD
        truckMap.set(fleetNumber, truck)
      }

      // Weekly summary
      const dateStr = trip.arrival_date || trip.departure_date
      if (dateStr) {
        const date = new Date(dateStr)
        const weekNum = getISOWeek(date)
        const year = getISOWeekYear(date)
        const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`
        const week = weeklyMap.get(weekKey) || { week: weekNum, year, trips: 0, km: 0, revenue_zar: 0, revenue_usd: 0, expenses_zar: 0, expenses_usd: 0 }
        week.trips += 1
        week.km += km
        if (currency === 'ZAR') week.revenue_zar += revenue; else week.revenue_usd += revenue
        week.expenses_zar += costs.ZAR
        week.expenses_usd += costs.USD
        weeklyMap.set(weekKey, week)

        // Monthly summary
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const month = monthlyMap.get(monthKey) || { month: monthNames[date.getMonth()], year: date.getFullYear(), trips: 0, km: 0, revenue_zar: 0, revenue_usd: 0, expenses_zar: 0, expenses_usd: 0 }
        month.trips += 1
        month.km += km
        if (currency === 'ZAR') month.revenue_zar += revenue; else month.revenue_usd += revenue
        month.expenses_zar += costs.ZAR
        month.expenses_usd += costs.USD
        monthlyMap.set(monthKey, month)
      }
    })

    // Prepare sheet data with headers matching your requested format

    // Summary sheet
    const marginZAR = totalRevenueZAR > 0 ? ((totalRevenueZAR - totalExpensesZAR) / totalRevenueZAR * 100).toFixed(2) + '%' : '0%'
    const marginUSD = totalRevenueUSD > 0 ? ((totalRevenueUSD - totalExpensesUSD) / totalRevenueUSD * 100).toFixed(2) + '%' : '0%'

    const summaryData = [
      ['Trip Reports Summary'],
      ['Period', period],
      ['Generated', new Date().toISOString()],
      [''],
      ['Overall Statistics'],
      ['Total Trips', trips.length],
      ['Total Kilometers', totalKm],
      [''],
      ['Financial Summary (ZAR)'],
      ['Revenue (ZAR)', totalRevenueZAR],
      ['Expenses (ZAR)', totalExpensesZAR],
      ['Net Profit (ZAR)', totalRevenueZAR - totalExpensesZAR],
      ['Profit Margin (ZAR)', marginZAR],
      [''],
      ['Financial Summary (USD)'],
      ['Revenue (USD)', totalRevenueUSD],
      ['Expenses (USD)', totalExpensesUSD],
      ['Net Profit (USD)', totalRevenueUSD - totalExpensesUSD],
      ['Profit Margin (USD)', marginUSD],
    ]

    // Client sheet: Client, Trips, Revenue (ZAR), Revenue (USD), Expenses (ZAR), Expenses (USD), Profit (ZAR), Profit (USD)
    const clientData = [
      ['Client', 'Trips', 'Revenue (ZAR)', 'Revenue (USD)', 'Expenses (ZAR)', 'Expenses (USD)', 'Profit (ZAR)', 'Profit (USD)'],
      ...Array.from(clientMap.entries())
        .sort((a, b) => (b[1].revenue_zar + b[1].revenue_usd) - (a[1].revenue_zar + a[1].revenue_usd))
        .map(([name, d]) => [name, d.trips, d.revenue_zar, d.revenue_usd, d.expenses_zar, d.expenses_usd, d.revenue_zar - d.expenses_zar, d.revenue_usd - d.expenses_usd])
    ]

    // Driver sheet: Driver, Trips, KM, Revenue (ZAR), Revenue (USD), Expenses (ZAR), Expenses (USD), Profit (ZAR), Profit (USD)
    const driverData = [
      ['Driver', 'Trips', 'KM', 'Revenue (ZAR)', 'Revenue (USD)', 'Expenses (ZAR)', 'Expenses (USD)', 'Profit (ZAR)', 'Profit (USD)'],
      ...Array.from(driverMap.entries())
        .sort((a, b) => (b[1].revenue_zar + b[1].revenue_usd) - (a[1].revenue_zar + a[1].revenue_usd))
        .map(([name, d]) => [name, d.trips, d.km, d.revenue_zar, d.revenue_usd, d.expenses_zar, d.expenses_usd, d.revenue_zar - d.expenses_zar, d.revenue_usd - d.expenses_usd])
    ]

    // Truck sheet: Truck, Trips, KM, Revenue (ZAR), Revenue (USD), Expenses (ZAR), Expenses (USD), Profit (ZAR), Profit (USD)
    const truckData = [
      ['Truck', 'Trips', 'KM', 'Revenue (ZAR)', 'Revenue (USD)', 'Expenses (ZAR)', 'Expenses (USD)', 'Profit (ZAR)', 'Profit (USD)'],
      ...Array.from(truckMap.entries())
        .sort((a, b) => (b[1].revenue_zar + b[1].revenue_usd) - (a[1].revenue_zar + a[1].revenue_usd))
        .map(([name, d]) => [name, d.trips, d.km, d.revenue_zar, d.revenue_usd, d.expenses_zar, d.expenses_usd, d.revenue_zar - d.expenses_zar, d.revenue_usd - d.expenses_usd])
    ]

    // Weekly sheet: Week, Year, Trips, KM, Revenue (ZAR), Revenue (USD), Expenses (ZAR), Expenses (USD), Profit (ZAR), Profit (USD)
    const weeklyData = [
      ['Week', 'Year', 'Trips', 'KM', 'Revenue (ZAR)', 'Revenue (USD)', 'Expenses (ZAR)', 'Expenses (USD)', 'Profit (ZAR)', 'Profit (USD)'],
      ...Array.from(weeklyMap.values())
        .sort((a, b) => `${b.year}-${b.week}`.localeCompare(`${a.year}-${a.week}`))
        .map(d => [d.week, d.year, d.trips, d.km, d.revenue_zar, d.revenue_usd, d.expenses_zar, d.expenses_usd, d.revenue_zar - d.expenses_zar, d.revenue_usd - d.expenses_usd])
    ]

    // Monthly sheet: Month, Year, Trips, KM, Revenue (ZAR), Revenue (USD), Expenses (ZAR), Expenses (USD), Profit (ZAR), Profit (USD)
    const monthlyData = [
      ['Month', 'Year', 'Trips', 'KM', 'Revenue (ZAR)', 'Revenue (USD)', 'Expenses (ZAR)', 'Expenses (USD)', 'Profit (ZAR)', 'Profit (USD)'],
      ...Array.from(monthlyMap.values())
        .sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`))
        .map(d => [d.month, d.year, d.trips, d.km, d.revenue_zar, d.revenue_usd, d.expenses_zar, d.expenses_usd, d.revenue_zar - d.expenses_zar, d.revenue_usd - d.expenses_usd])
    ]

    // Update each sheet
    await updateSheet(accessToken, spreadsheetId, 'Summary', summaryData)
    await updateSheet(accessToken, spreadsheetId, 'By Client', clientData)
    await updateSheet(accessToken, spreadsheetId, 'By Driver', driverData)
    await updateSheet(accessToken, spreadsheetId, 'By Truck', truckData)
    await updateSheet(accessToken, spreadsheetId, 'Weekly', weeklyData)
    await updateSheet(accessToken, spreadsheetId, 'Monthly', monthlyData)

    return new Response(JSON.stringify({
      success: true,
      message: 'Google Sheet updated successfully',
      updated_at: new Date().toISOString(),
      period: period,
      trips_processed: trips.length,
      sheets_updated: ['Summary', 'By Client', 'By Driver', 'By Truck', 'Weekly', 'Monthly'],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Helper: Get ISO week number
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Helper: Get ISO week year
function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d.getUTCFullYear()
}
