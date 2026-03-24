function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("1");
  const scriptTimestamp = new Date();

  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput("❌ No POST data received.");
  }

  const payload = JSON.parse(e.postData.contents);
  const event = payload.data || payload; 
  
  // Extract your payload data (adjust these to match your exact JSON keys if needed)
  const serialNumber = event.serial_number || event.device_id || event.id || "";
  const eventType = String(event.eventType || event.type || "").trim();
  const eventTime = event.eventTime || event.time || event.timestamp || "";
  const latitude = event.latitude || event.lat || "";
  const longitude = event.longitude || event.lng || event.lon || "";
  const altitude = event.altitude || event.alt || "";
  const speed = event.speed || "";
  const driverDetected = event.driver_detected || event.driverDetected || "No";
  
  // 1. THE FILTER: Define exactly which raw events you want to allow
  const allowedEvents = [
    "harsh_acceleration",
    "seatbelt_violation_beep",
    "seatbelt_violation",
    "cell_phone_use_beep",
    "cell_phone_use",
    "fatigue_alert_beep",
    "yawn_beep",
    "harsh_braking",
    "speedlimit",
    "SpeedLimit",
    "lane_weaving",
    "distracted_driver_beep",
    "distracted_driving",
    "tailgating",
    "accident",
    "driver_unbelted_beep",
    "passenger_limit",
    "obstruction",
    "driverUnbelted"
  ];

  // If the event isn't in the list (like 'acc_off' or 'acc_on'), completely ignore it
  if (!allowedEvents.includes(eventType)) {
    return ContentService.createTextOutput(`ℹ️ Ignored: ${eventType} is not in the allowed event list.`);
  }
  
  // 2. THE COOLDOWN: Check for duplicates within 5 minutes using event time (Column D)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1 && eventTime) {
    // Read existing data (Columns B, C, and D for checking)
    const existingData = sheet.getRange(2, 2, lastRow - 1, 3).getValues(); // Columns B, C, D
    
    // Convert the incoming eventTime to a Date object for comparison
    const incomingEventDate = new Date(eventTime);
    
    // Check if the incoming eventTime is valid
    if (isNaN(incomingEventDate.getTime())) {
      return ContentService.createTextOutput(`⚠️ Invalid event time format: ${eventTime}`);
    }
    
    for (let i = existingData.length - 1; i >= 0; i--) { 
      const existingRow = existingData[i];
      const existingSerial = existingRow[0];      // Column B (Serial Number)
      const existingEventType = existingRow[1];   // Column C (Event Type)
      const existingEventTime = existingRow[2];   // Column D (Event Time from device)
      
      // Check if serial and event type match
      if (existingSerial == serialNumber && existingEventType === eventType) {
        // Convert existing event time to Date object
        const existingEventDate = new Date(existingEventTime);
        
        // Calculate time difference based on event times
        const timeDiff = Math.abs(incomingEventDate.getTime() - existingEventDate.getTime());
        const fiveMinutesInMs = 5 * 60 * 1000; 
        
        // If within 5 minutes, reject the event entirely
        if (timeDiff < fiveMinutesInMs) {
          return ContentService.createTextOutput(`⚠️ Duplicate ignored: ${eventType} for ${serialNumber}. Under 5 min cooldown. Last occurred: ${existingEventTime}`);
        }
        break; // Stop checking further back once we find the most recent matching event
      }
    }
  }

  // 3. WRITE TO SHEET: If it passes the filter and cooldown, log all 9 columns
  const targetRow = sheet.getLastRow() + 1;
  sheet.getRange(targetRow, 1, 1, 9).setValues([[
    scriptTimestamp, // Column A: Script Timestamp
    serialNumber,    // Column B: Serial Number
    eventType,       // Column C: Event Type
    eventTime,       // Column D: Event Time (from device)
    latitude,        // Column E: Latitude
    longitude,       // Column F: Longitude
    altitude,        // Column G: Altitude
    speed,           // Column H: Speed
    driverDetected   // Column I: Driver Detected
  ]]);

  return ContentService.createTextOutput(`✅ Event recorded: ${eventType} for ${serialNumber}`);
}