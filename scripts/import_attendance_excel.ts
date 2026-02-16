/**
 * Script to import attendance data from Excel file
 * 
 * Usage:
 * 1. Place your Excel file at: scripts/Anwesenheit.xlsx
 * 2. Run: tsx scripts/import_attendance_excel.ts
 * 
 * This will:
 * - Create members from Excel rows
 * - Create sessions from Excel columns (dates)
 * - Import all attendance records
 */

import { readFileSync } from "fs";
import { join } from "path";
import * as XLSX from "xlsx";
import { getDb } from "../server/db";
import {
  createAttendanceMember,
  createAttendanceSession,
  upsertAttendanceRecord,
} from "../server/attendance_db";

interface ExcelRow {
  memberName: string;
  dates: { [date: string]: string | null };
}

async function importExcel() {
  console.log("📂 Reading Excel file...");
  
  const excelPath = join(__dirname, "Anwesenheit.xlsx");
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log("📊 Parsing data...");
  
  // First row is empty, second row contains dates
  const dateRow = data[1];
  const dates: string[] = [];
  
  // Extract dates (skip first column which is empty)
  for (let i = 1; i < dateRow.length; i++) {
    if (dateRow[i]) {
      // Excel dates are numbers, convert to ISO string
      const excelDate = dateRow[i];
      let dateStr: string;
      
      if (typeof excelDate === "number") {
        // Excel date to JS date
        const jsDate = XLSX.SSF.parse_date_code(excelDate);
        dateStr = `${jsDate.y}-${String(jsDate.m).padStart(2, "0")}-${String(jsDate.d).padStart(2, "0")}`;
      } else {
        // Already a string, parse it
        const d = new Date(excelDate);
        dateStr = d.toISOString().split("T")[0];
      }
      
      dates.push(dateStr);
    }
  }
  
  console.log(`Found ${dates.length} dates:`, dates);
  
  // Extract member names and their attendance
  const rows: ExcelRow[] = [];
  
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // Skip empty rows
    
    const memberName = row[0].toString().trim();
    const attendance: { [date: string]: string | null } = {};
    
    for (let j = 0; j < dates.length; j++) {
      const value = row[j + 1];
      attendance[dates[j]] = value ? value.toString().trim() : null;
    }
    
    rows.push({
      memberName,
      dates: attendance,
    });
  }
  
  console.log(`Found ${rows.length} members:`, rows.map(r => r.memberName));
  
  // Connect to database
  console.log("🔌 Connecting to database...");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Create members
  console.log("👥 Creating members...");
  const memberMap: { [name: string]: number } = {};
  
  for (const row of rows) {
    const memberId = await createAttendanceMember({
      name: row.memberName,
      isActive: true,
      displayOrder: 0,
    });
    memberMap[row.memberName] = memberId;
    console.log(`  ✓ Created member: ${row.memberName} (ID: ${memberId})`);
  }
  
  // Create sessions (assume all are meetings for now, can be changed manually)
  console.log("📅 Creating sessions...");
  const sessionMap: { [date: string]: number } = {};
  
  for (const date of dates) {
    const sessionId = await createAttendanceSession({
      date,
      title: `Meeting ${date}`,
      type: "meeting",
      notes: "Importiert aus Excel",
    });
    sessionMap[date] = sessionId;
    console.log(`  ✓ Created session: ${date} (ID: ${sessionId})`);
  }
  
  // Import attendance records
  console.log("✅ Importing attendance records...");
  let recordCount = 0;
  
  for (const row of rows) {
    const memberId = memberMap[row.memberName];
    
    for (const [date, value] of Object.entries(row.dates)) {
      const sessionId = sessionMap[date];
      
      // Determine status
      let status: "present" | "partial" | "absent";
      if (value === "x" || value === "X") {
        status = "present";
      } else if (value) {
        // Any other value = present (could be notes)
        status = "present";
      } else {
        status = "absent";
      }
      
      await upsertAttendanceRecord({
        sessionId,
        memberId,
        status,
        notes: null,
      });
      
      recordCount++;
    }
  }
  
  console.log(`  ✓ Imported ${recordCount} attendance records`);
  
  console.log("\n🎉 Import completed successfully!");
  console.log("\n📝 Next steps:");
  console.log("  1. Review imported data on the website");
  console.log("  2. Update session titles and types (meeting/event) as needed");
  console.log("  3. Add notes to members if needed");
  
  process.exit(0);
}

// Run import
importExcel().catch((error) => {
  console.error("❌ Import failed:", error);
  process.exit(1);
});
