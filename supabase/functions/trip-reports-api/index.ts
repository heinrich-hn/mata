// Trip Reports API - Returns trip report data for Power Automate/SharePoint integration
// This endpoint can be called by Power Automate to sync data to SharePoint Excel

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CurrencyAmounts {
  ZAR: number
  USD: number
}

interface TripData {
  id: string
  trip_number: string
  driver_name: string | null
  client_name: string | null
  fleet_number: string | null
  base_revenue: number | null
  revenue_currency: string | null
  distance_km: number | null
  departure_date: string | null
  arrival_date: string | null
  status: string
  origin: string | null
  destination: string | null
}

interface CostEntry {
  id: string
  trip_id: string
  amount: number
  currency: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get period from query params (default: 1year for full year data)
    const url = new URL(req.url)
    const period = url.searchParams.get('period') || '1year'

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
        startDate = new Date(now.getFullYear(), 0, 1) // January 1st of current year
        break
      case 'all':
      default:
        startDate = null
    }

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

    if (tripsError) {
      throw new Error(`Failed to fetch trips: ${tripsError.message}`)
    }

    // Process trips to extract fleet_number
    const trips: TripData[] = (tripsRaw || []).map((trip: any) => ({
      ...trip,
      fleet_number: trip.vehicles?.fleet_number || trip.wialon_vehicles?.fleet_number || null,
    }))

    // Fetch cost entries
    const tripIds = trips.map(t => t.id)
    let costEntries: CostEntry[] = []

    if (tripIds.length > 0) {
      const { data: costs, error: costsError } = await supabase
        .from('cost_entries')
        .select('id, trip_id, amount, currency')
        .in('trip_id', tripIds)

      if (costsError) {
        console.error('Failed to fetch costs:', costsError)
      } else {
        costEntries = costs || []
      }
    }

    // Helper: Get costs by trip
    const getTripCostsByCurrency = (tripId: string): CurrencyAmounts => {
      const tripCosts = costEntries.filter(c => c.trip_id === tripId)
      return {
        ZAR: tripCosts.filter(c => (c.currency || 'ZAR') === 'ZAR').reduce((sum, c) => sum + (c.amount || 0), 0),
        USD: tripCosts.filter(c => c.currency === 'USD').reduce((sum, c) => sum + (c.amount || 0), 0),
      }
    }

    // Calculate Client Summary
    const clientMap = new Map<string, any>()
    trips.forEach(trip => {
      const clientName = trip.client_name || 'No Client'
      const existing = clientMap.get(clientName) || {
        client: clientName,
        trips: 0,
        revenue_zar: 0,
        revenue_usd: 0,
        expenses_zar: 0,
        expenses_usd: 0,
        profit_zar: 0,
        profit_usd: 0,
      }

      const costs = getTripCostsByCurrency(trip.id)
      const currency = (trip.revenue_currency || 'ZAR') as 'ZAR' | 'USD'
      const revenue = trip.base_revenue || 0

      existing.trips += 1
      if (currency === 'ZAR') existing.revenue_zar += revenue
      else existing.revenue_usd += revenue
      existing.expenses_zar += costs.ZAR
      existing.expenses_usd += costs.USD
      existing.profit_zar = existing.revenue_zar - existing.expenses_zar
      existing.profit_usd = existing.revenue_usd - existing.expenses_usd

      clientMap.set(clientName, existing)
    })

    // Calculate Driver Summary
    const driverMap = new Map<string, any>()
    trips.forEach(trip => {
      const driverName = trip.driver_name || 'Unassigned'
      const existing = driverMap.get(driverName) || {
        driver: driverName,
        trips: 0,
        km: 0,
        revenue_zar: 0,
        revenue_usd: 0,
        expenses_zar: 0,
        expenses_usd: 0,
        profit_zar: 0,
        profit_usd: 0,
      }

      const costs = getTripCostsByCurrency(trip.id)
      const currency = (trip.revenue_currency || 'ZAR') as 'ZAR' | 'USD'
      const revenue = trip.base_revenue || 0

      existing.trips += 1
      existing.km += trip.distance_km || 0
      if (currency === 'ZAR') existing.revenue_zar += revenue
      else existing.revenue_usd += revenue
      existing.expenses_zar += costs.ZAR
      existing.expenses_usd += costs.USD
      existing.profit_zar = existing.revenue_zar - existing.expenses_zar
      existing.profit_usd = existing.revenue_usd - existing.expenses_usd

      driverMap.set(driverName, existing)
    })

    // Calculate Truck Summary - grouped by fleet number only
    const truckMap = new Map<string, any>()
    trips.forEach(trip => {
      const fleetNumber = (trip.fleet_number || '').toUpperCase().trim()
      if (!fleetNumber) return

      const existing = truckMap.get(fleetNumber) || {
        truck: fleetNumber,
        trips: 0,
        km: 0,
        revenue_zar: 0,
        revenue_usd: 0,
        expenses_zar: 0,
        expenses_usd: 0,
        profit_zar: 0,
        profit_usd: 0,
      }

      const costs = getTripCostsByCurrency(trip.id)
      const currency = (trip.revenue_currency || 'ZAR') as 'ZAR' | 'USD'
      const revenue = trip.base_revenue || 0

      existing.trips += 1
      existing.km += trip.distance_km || 0
      if (currency === 'ZAR') existing.revenue_zar += revenue
      else existing.revenue_usd += revenue
      existing.expenses_zar += costs.ZAR
      existing.expenses_usd += costs.USD
      existing.profit_zar = existing.revenue_zar - existing.expenses_zar
      existing.profit_usd = existing.revenue_usd - existing.expenses_usd

      truckMap.set(fleetNumber, existing)
    })

    // Calculate Weekly Summary
    const weeklyMap = new Map<string, any>()
    trips.forEach(trip => {
      const dateStr = trip.arrival_date || trip.departure_date
      if (!dateStr) return

      const date = new Date(dateStr)
      const weekNumber = getISOWeek(date)
      const year = getISOWeekYear(date)
      const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`

      const existing = weeklyMap.get(weekKey) || {
        week: weekNumber,
        year: year,
        trips: 0,
        km: 0,
        revenue_zar: 0,
        revenue_usd: 0,
        expenses_zar: 0,
        expenses_usd: 0,
        profit_zar: 0,
        profit_usd: 0,
      }

      const costs = getTripCostsByCurrency(trip.id)
      const currency = (trip.revenue_currency || 'ZAR') as 'ZAR' | 'USD'
      const revenue = trip.base_revenue || 0

      existing.trips += 1
      existing.km += trip.distance_km || 0
      if (currency === 'ZAR') existing.revenue_zar += revenue
      else existing.revenue_usd += revenue
      existing.expenses_zar += costs.ZAR
      existing.expenses_usd += costs.USD
      existing.profit_zar = existing.revenue_zar - existing.expenses_zar
      existing.profit_usd = existing.revenue_usd - existing.expenses_usd

      weeklyMap.set(weekKey, existing)
    })

    // Calculate Monthly Summary
    const monthlyMap = new Map<string, any>()
    trips.forEach(trip => {
      const dateStr = trip.arrival_date || trip.departure_date
      if (!dateStr) return

      const date = new Date(dateStr)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December']

      const existing = monthlyMap.get(monthKey) || {
        month: monthNames[date.getMonth()],
        year: date.getFullYear(),
        trips: 0,
        km: 0,
        revenue_zar: 0,
        revenue_usd: 0,
        expenses_zar: 0,
        expenses_usd: 0,
        profit_zar: 0,
        profit_usd: 0,
      }

      const costs = getTripCostsByCurrency(trip.id)
      const currency = (trip.revenue_currency || 'ZAR') as 'ZAR' | 'USD'
      const revenue = trip.base_revenue || 0

      existing.trips += 1
      existing.km += trip.distance_km || 0
      if (currency === 'ZAR') existing.revenue_zar += revenue
      else existing.revenue_usd += revenue
      existing.expenses_zar += costs.ZAR
      existing.expenses_usd += costs.USD
      existing.profit_zar = existing.revenue_zar - existing.expenses_zar
      existing.profit_usd = existing.revenue_usd - existing.expenses_usd

      monthlyMap.set(monthKey, existing)
    })

    // Calculate Overall Summary
    let totalRevenueZAR = 0, totalRevenueUSD = 0
    let totalExpensesZAR = 0, totalExpensesUSD = 0
    let totalKm = 0

    trips.forEach(trip => {
      const costs = getTripCostsByCurrency(trip.id)
      const currency = (trip.revenue_currency || 'ZAR') as 'ZAR' | 'USD'
      const revenue = trip.base_revenue || 0

      if (currency === 'ZAR') totalRevenueZAR += revenue
      else totalRevenueUSD += revenue
      totalExpensesZAR += costs.ZAR
      totalExpensesUSD += costs.USD
      totalKm += trip.distance_km || 0
    })

    const marginZAR = totalRevenueZAR > 0
      ? ((totalRevenueZAR - totalExpensesZAR) / totalRevenueZAR * 100).toFixed(2) + '%'
      : '0%'
    const marginUSD = totalRevenueUSD > 0
      ? ((totalRevenueUSD - totalExpensesUSD) / totalRevenueUSD * 100).toFixed(2) + '%'
      : '0%'

    // Build response
    const response = {
      generated_at: new Date().toISOString(),
      period: period,
      summary: {
        total_trips: trips.length,
        total_km: totalKm,
        revenue_zar: totalRevenueZAR,
        revenue_usd: totalRevenueUSD,
        expenses_zar: totalExpensesZAR,
        expenses_usd: totalExpensesUSD,
        profit_zar: totalRevenueZAR - totalExpensesZAR,
        profit_usd: totalRevenueUSD - totalExpensesUSD,
        margin_zar: marginZAR,
        margin_usd: marginUSD,
      },
      by_client: Array.from(clientMap.values()).sort((a, b) => (b.revenue_zar + b.revenue_usd) - (a.revenue_zar + a.revenue_usd)),
      by_driver: Array.from(driverMap.values()).sort((a, b) => (b.revenue_zar + b.revenue_usd) - (a.revenue_zar + a.revenue_usd)),
      by_truck: Array.from(truckMap.values()).sort((a, b) => (b.revenue_zar + b.revenue_usd) - (a.revenue_zar + a.revenue_usd)),
      weekly: Array.from(weeklyMap.values()).sort((a, b) => `${b.year}-${b.week}`.localeCompare(`${a.year}-${a.week}`)),
      monthly: Array.from(monthlyMap.values()).sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`)),
    }

    return new Response(JSON.stringify(response, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
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
