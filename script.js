// =====================
// 🔗 CONNECT TO SUPABASE
// =====================
if (!window._supabaseClient) {
  window._supabaseClient = window.supabase.createClient(
    "https://pudsmhaclqcoibifmgff.supabase.co",
    "sb_publishable_KsIFgpEuJa7E4xrLXiqvUw_ug9NHlKr"
  );
}

var supabase = window._supabaseClient;

console.log("SCRIPT LOADED");

// Global flag to prevent multiple submissions
let isSubmitting = false;

// =====================
// 🔐 LOGIN (TEACHERS)
// =====================
async function login() {
  console.log("Login clicked");

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    alert("Login failed: " + error.message);
    console.error(error);
  } else {
    console.log("Login success", data);
    window.location.href = "dashboard.html";
  }
}

// =====================
// 📊 LOAD SUBJECTS (WITHOUT DUPLICATES)
// =====================
async function loadSubjects() {
  const { data, error } = await supabase
    .from("subjects")
    .select("*");

  if (error) {
    console.error("Error loading subjects:", error);
    return;
  }

  const container = document.getElementById("subjectsContainer");
  if (!container) return;
  container.innerHTML = "";

  // Remove duplicates by subject_name
  let uniqueSubjects = [];
  let subjectNames = [];
  
  data.forEach(subject => {
    if (!subjectNames.includes(subject.subject_name)) {
      subjectNames.push(subject.subject_name);
      uniqueSubjects.push(subject);
    }
  });

  uniqueSubjects.forEach(subject => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerText = subject.subject_name;

    div.onclick = () => {
      localStorage.setItem("subject_id", subject.id);
      localStorage.setItem("subject_name", subject.subject_name);
      window.location.href = "attendance.html";
    };

    container.appendChild(div);
  });
}

// =====================
// 📋 LOAD STUDENTS BY SUBJECT
// =====================
async function loadStudents() {
  const subject_id = localStorage.getItem("subject_id");

  const { data, error } = await supabase
    .from("enrollments")
    .select(`
      student_id,
      students (id, name)
    `)
    .eq("subject_id", subject_id);

  if (error) {
    console.error("Error loading students:", error);
    return;
  }

  const list = document.getElementById("studentList");
  if (!list) return;

  list.innerHTML = "";

  data.forEach(item => {
    const student = item.students;

    const div = document.createElement("div");

    div.innerHTML = `
      <label>
        <input type="checkbox" value="` + student.id + `">
        ` + student.name + `
      </label>
    `;

    list.appendChild(div);
  });
  
  loadExistingAttendance();
}

// =====================
// 📌 LOAD EXISTING ATTENDANCE FOR TODAY
// =====================
async function loadExistingAttendance() {
  const subject_id = localStorage.getItem("subject_id");
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("attendance")
    .select("student_id, status")
    .eq("subject_id", subject_id)
    .eq("attendance_date", today);

  if (error) {
    console.error("Error loading existing attendance:", error);
    return;
  }

  if (data && data.length > 0) {
    data.forEach(record => {
      if (record.status === "present") {
        const checkbox = document.querySelector("#studentList input[value='" + record.student_id + "']");
        if (checkbox) {
          checkbox.checked = true;
        }
      }
    });
    console.log("Loaded " + data.length + " existing attendance records for today");
  }
}

// =====================
// ✅ SUBMIT ATTENDANCE
// =====================
async function submitAttendance() {
  if (isSubmitting) {
    console.log("Already submitting, please wait...");
    return;
  }

  const subject_id = localStorage.getItem("subject_id");
  const subject_name = localStorage.getItem("subject_name");

  if (!subject_id) {
    alert("No subject selected. Please go back and select a subject.");
    return;
  }

  const checkboxes = document.querySelectorAll("#studentList input[type=checkbox]");
  const today = new Date().toISOString().split("T")[0];

  const submitBtn = document.getElementById("submitBtn");
  const originalBtnText = submitBtn.innerHTML;
  
  isSubmitting = true;
  submitBtn.innerHTML = "Saving...";
  submitBtn.disabled = true;

  try {
    // Step 1: Delete existing records
    const { error: deleteError } = await supabase
      .from("attendance")
      .delete()
      .eq("subject_id", subject_id)
      .eq("attendance_date", today);

    if (deleteError) {
      alert("Error clearing previous attendance: " + deleteError.message);
      return;
    }

    // Step 2: Prepare and insert records
    let records = [];
    checkboxes.forEach(cb => {
      records.push({
        student_id: cb.value,
        subject_id: subject_id,
        attendance_date: today,
        status: cb.checked ? "present" : "absent"
      });
    });

    if (records.length === 0) {
      alert("No students to mark attendance for.");
      return;
    }

    const { error: insertError } = await supabase
      .from("attendance")
      .insert(records);

    if (insertError) {
      alert("Error saving attendance: " + insertError.message);
    } else {
      alert("✅ Attendance for " + subject_name + " saved successfully! (" + records.length + " students)");
    }
    
  } catch (err) {
    console.error("Unexpected error:", err);
    alert("Unexpected error: " + err.message);
  } finally {
    setTimeout(function() {
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
      isSubmitting = false;
    }, 1000);
  }
}

// =====================
// 📋 VIEW ATTENDANCE REPORT (DAILY)
// =====================
async function viewAttendanceReport() {
  const subject_id = localStorage.getItem("subject_id");
  const subject_name = localStorage.getItem("subject_name");
  const today = new Date().toISOString().split("T")[0];
  const displayDate = new Date().toLocaleDateString();

  if (!subject_id) {
    alert("No subject selected. Please go back and select a subject.");
    return;
  }

  const { data, error } = await supabase
    .from("attendance")
    .select(`
      status,
      students (name)
    `)
    .eq("subject_id", subject_id)
    .eq("attendance_date", today);

  if (error) {
    alert("Error loading report: " + error.message);
    return;
  }

  if (!data || data.length === 0) {
    alert("No attendance records for " + subject_name + " on " + displayDate + "\n\nPlease submit attendance first.");
    return;
  }

  let presentStudents = [];
  let absentStudents = [];
  
  data.forEach(function(r) {
    if (r.status === "present") {
      presentStudents.push(r.students.name);
    } else {
      absentStudents.push(r.students.name);
    }
  });

  let reportMessage = "📋 ATTENDANCE REPORT\n";
  reportMessage += "Subject: " + subject_name + "\n";
  reportMessage += "Date: " + displayDate + "\n";
  reportMessage += "------------------------\n\n";
  reportMessage += "✅ PRESENT (" + presentStudents.length + "):\n";
  reportMessage += presentStudents.length > 0 ? presentStudents.join("\n") : "None\n";
  reportMessage += "\n\n❌ ABSENT (" + absentStudents.length + "):\n";
  reportMessage += absentStudents.length > 0 ? absentStudents.join("\n") : "None\n";
  reportMessage += "\n\n------------------------\n";
  reportMessage += "📊 Total Students: " + data.length;
  reportMessage += "\n📈 Attendance Rate: " + Math.round((presentStudents.length / data.length) * 100) + "%";

  alert(reportMessage);
}

// =====================
// 📅 WEEKLY ATTENDANCE SUMMARY
// =====================
async function weeklyAttendanceSummary() {
  const subject_id = localStorage.getItem("subject_id");
  const subject_name = localStorage.getItem("subject_name");

  if (!subject_id) {
    alert("No subject selected. Please go back and select a subject.");
    return;
  }

  const exportBtn = document.getElementById("weeklyReportBtn");
  const originalText = exportBtn.innerHTML;
  exportBtn.innerHTML = "⏳ Loading...";
  exportBtn.disabled = true;

  try {
    // Get current date and calculate Monday of this week
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate Monday (if today is Sunday, go back 6 days)
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday);
    
    // Calculate Friday (Monday + 4 days)
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    
    // Format dates for display
    const weekStart = monday.toLocaleDateString();
    const weekEnd = friday.toLocaleDateString();
    
    // Get all students for this subject
    const { data: studentsData, error: studentsError } = await supabase
      .from("enrollments")
      .select(`
        student_id,
        students (id, name)
      `)
      .eq("subject_id", subject_id);
    
    if (studentsError) {
      alert("Error loading students: " + studentsError.message);
      return;
    }
    
    if (!studentsData || studentsData.length === 0) {
      alert("No students enrolled in this subject.");
      return;
    }
    
    // Prepare array of student names and IDs
    let students = [];
    studentsData.forEach(item => {
      students.push({
        id: item.student_id,
        name: item.students.name
      });
    });
    
    // Get attendance for the entire week (Monday to Friday)
    const startDate = monday.toISOString().split("T")[0];
    const endDate = friday.toISOString().split("T")[0];
    
    const { data: attendanceData, error: attendanceError } = await supabase
      .from("attendance")
      .select("student_id, attendance_date, status")
      .eq("subject_id", subject_id)
      .gte("attendance_date", startDate)
      .lte("attendance_date", endDate);
    
    if (attendanceError) {
      alert("Error loading attendance: " + attendanceError.message);
      return;
    }
    
    // Build a map of attendance by student and date
    let attendanceMap = {};
    if (attendanceData) {
      attendanceData.forEach(record => {
        const studentId = record.student_id;
        const date = record.attendance_date;
        if (!attendanceMap[studentId]) {
          attendanceMap[studentId] = {};
        }
        attendanceMap[studentId][date] = record.status;
      });
    }
    
    // Generate the 5 weekdays (Monday to Friday)
    let weekDates = [];
    let dateLabels = [];
    for (let i = 0; i < 5; i++) {
      let currentDate = new Date(monday);
      currentDate.setDate(monday.getDate() + i);
      const dateStr = currentDate.toISOString().split("T")[0];
      const dayName = currentDate.toLocaleDateString(undefined, { weekday: 'short' });
      weekDates.push(dateStr);
      dateLabels.push(dayName);
    }
    
    // Build the report content
    let reportMessage = "📅 WEEKLY ATTENDANCE SUMMARY\n";
    reportMessage += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    reportMessage += "Subject: " + subject_name + "\n";
    reportMessage += "Week: " + weekStart + " to " + weekEnd + "\n";
    reportMessage += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    
    // Header row with dates
    reportMessage += "Student Name".padEnd(25);
    for (let i = 0; i < dateLabels.length; i++) {
      reportMessage += dateLabels[i].padEnd(10);
    }
    reportMessage += "Total".padEnd(8) + "%\n";
    reportMessage += "━".repeat(25 + (10 * 5) + 8 + 4) + "\n";
    
    // Calculate summary statistics
    let totalPresentWeek = 0;
    let totalPossible = 0;
    
    // Add each student's attendance
    students.forEach(student => {
      let row = student.name.substring(0, 22).padEnd(25);
      let presentCount = 0;
      let totalDays = 0;
      
      for (let i = 0; i < weekDates.length; i++) {
        const date = weekDates[i];
        const status = attendanceMap[student.id] && attendanceMap[student.id][date];
        
        if (status === "present") {
          row += "✓".padEnd(10);
          presentCount++;
          totalDays++;
        } else if (status === "absent") {
          row += "✗".padEnd(10);
          totalDays++;
        } else {
          row += "?".padEnd(10); // No record yet
        }
      }
      
      const percentage = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;
      row += presentCount + "/" + totalDays;
      row = row.padEnd(25 + (10 * 5) + 8) + percentage + "%";
      reportMessage += row + "\n";
      
      totalPresentWeek += presentCount;
      totalPossible += totalDays;
    });
    
    reportMessage += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    const overallPercentage = totalPossible > 0 ? Math.round((totalPresentWeek / totalPossible) * 100) : 0;
    reportMessage += "📊 Class Overall: " + totalPresentWeek + "/" + totalPossible + " (" + overallPercentage + "%)\n";
    reportMessage += "📅 Week: " + weekStart + " to " + weekEnd + "\n";
    
    alert(reportMessage);
    
    // Also offer to export as text file
    if (confirm("Do you want to save this report as a text file?")) {
      const blob = new Blob([reportMessage], { type: "text/plain" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = "Weekly_Attendance_" + subject_name.replace(/[^a-zA-Z0-9]/g, '_') + "_" + startDate + "_to_" + endDate + ".txt";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    
  } catch (err) {
    console.error("Weekly Summary Error:", err);
    alert("Error generating weekly summary: " + err.message);
  } finally {
    exportBtn.innerHTML = originalText;
    exportBtn.disabled = false;
  }
}

// =====================
// 📄 EXPORT TO PDF
// =====================
async function exportToPDF() {
  const subject_id = localStorage.getItem("subject_id");
  const subject_name = localStorage.getItem("subject_name");
  const today = new Date().toISOString().split("T")[0];
  const displayDate = new Date().toLocaleDateString();

  if (!subject_id) {
    alert("No subject selected. Please go back and select a subject.");
    return;
  }

  const exportBtn = document.getElementById("exportPdfBtn");
  const originalText = exportBtn.innerHTML;
  exportBtn.innerHTML = "⏳ Generating PDF...";
  exportBtn.disabled = true;

  try {
    const { data, error } = await supabase
      .from("attendance")
      .select(`
        status,
        students (name)
      `)
      .eq("subject_id", subject_id)
      .eq("attendance_date", today);

    if (error) {
      alert("Error loading data: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert("No attendance records for " + subject_name + " on " + displayDate + "\n\nPlease submit attendance first.");
      return;
    }

    let presentStudents = [];
    let absentStudents = [];
    
    data.forEach(function(r) {
      if (r.status === "present") {
        presentStudents.push(r.students.name);
      } else {
        absentStudents.push(r.students.name);
      }
    });

    const currentTime = new Date().toLocaleString();
    
    const pdfContent = `
      <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4a5568; margin-bottom: 10px;">📋 ATTENDANCE REPORT</h1>
          <hr style="border: 1px solid #e2e8f0;">
        </div>
        
        <div style="margin-bottom: 20px;">
          <p><strong>Subject:</strong> ${subject_name}</p>
          <p><strong>Date:</strong> ${displayDate}</p>
          <p><strong>Generated:</strong> ${currentTime}</p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #38a169; border-bottom: 2px solid #38a169; padding-bottom: 10px;">✅ PRESENT (${presentStudents.length})</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            ${presentStudents.map((student, index) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; width: 50px;">${index + 1}.</td>
                <td style="padding: 10px;">${student}</td>
                <td style="padding: 10px; color: #38a169;">✓ Present</td>
              </tr>
            `).join('')}
            ${presentStudents.length === 0 ? '<tr><td colspan="3" style="padding: 20px; text-align: center;">No students present</td></tr>' : ''}
          </table>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #e53e3e; border-bottom: 2px solid #e53e3e; padding-bottom: 10px;">❌ ABSENT (${absentStudents.length})</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            ${absentStudents.map((student, index) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; width: 50px;">${index + 1}.</td>
                <td style="padding: 10px;">${student}</td>
                <td style="padding: 10px; color: #e53e3e;">✗ Absent</td>
              </tr>
            `).join('')}
            ${absentStudents.length === 0 ? '<tr><td colspan="3" style="padding: 20px; text-align: center;">No students absent</td></tr>' : ''}
          </table>
        </div>
        
        <div style="margin-top: 40px; text-align: center; padding-top: 20px; border-top: 2px solid #e2e8f0;">
          <p style="color: #718096;">Total Students: ${data.length}</p>
          <p style="color: #718096;">Attendance Rate: ${Math.round((presentStudents.length / data.length) * 100)}%</p>
          <p style="color: #a0aec0; font-size: 10px;">Generated by Web Attendance System</p>
        </div>
      </div>
    `;

    const element = document.createElement('div');
    element.innerHTML = pdfContent;
    document.body.appendChild(element);
    
    const opt = {
      margin: [0.5, 0.5, 0.5, 0.5],
      filename: `Attendance_${subject_name.replace(/[^a-zA-Z0-9]/g, '_')}_${today}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, letterRendering: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    
    await html2pdf().set(opt).from(element).save();
    document.body.removeChild(element);
    
    alert("✅ PDF report generated successfully!");
    
  } catch (err) {
    console.error("PDF Error:", err);
    alert("Error generating PDF: " + err.message);
  } finally {
    exportBtn.innerHTML = originalText;
    exportBtn.disabled = false;
  }
}

// =====================
// 📊 EXPORT TO EXCEL
// =====================
async function exportToExcel() {
    const subject_id = localStorage.getItem("subject_id");
    const subject_name = localStorage.getItem("subject_name");
    const today = new Date().toISOString().split("T")[0];
    const displayDate = new Date().toLocaleDateString();

    if (!subject_id) {
        alert("No subject selected. Please go back and select a subject.");
        return;
    }

    const exportBtn = document.getElementById("exportExcelBtn");
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = "⏳ Generating Excel...";
    exportBtn.disabled = true;

    try {
        const { data, error } = await supabase
            .from("attendance")
            .select(`
                status,
                students (name)
            `)
            .eq("subject_id", subject_id)
            .eq("attendance_date", today);

        if (error) {
            alert("Error loading data: " + error
