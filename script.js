// =====================
// CONNECT TO SUPABASE
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
var isSubmitting = false;

// =====================
// TIMEZONE UTILITY (UTC+10:00 - Guam/Port Moresby)
// =====================
function getCurrentDateInUTC10() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Port_Moresby',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now);
}

function formatDateInUTC10(dateString) {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString + "T12:00:00");
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Pacific/Port_Moresby',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  } catch (e) {
    return dateString;
  }
}

function getWeekDatesInUTC10() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Port_Moresby',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayStr = formatter.format(now);
  const utc10Date = new Date(todayStr + "T12:00:00");
  
  const currentDay = utc10Date.getDay();
  const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const monday = new Date(utc10Date);
  monday.setDate(utc10Date.getDate() - daysToMonday);
  
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  
  return {
    monday: monday.toISOString().split("T")[0],
    friday: friday.toISOString().split("T")[0],
    mondayDisplay: monday.toLocaleDateString("en-US", { timeZone: "Pacific/Port_Moresby" }),
    fridayDisplay: friday.toLocaleDateString("en-US", { timeZone: "Pacific/Port_Moresby" })
  };
}

function getSemesterInUTC10() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Port_Moresby',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayStr = formatter.format(now);
  const utc10Date = new Date(todayStr + "T12:00:00");
  const year = utc10Date.getFullYear();
  const month = utc10Date.getMonth();
  return month < 6 ? year + "-S1" : year + "-S2";
}

// =====================
// LOGIN
// =====================
async function login() {
  console.log("Login clicked");

  var email = document.getElementById("email").value;
  var password = document.getElementById("password").value;

  var result = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (result.error) {
    alert("Login failed: " + result.error.message);
    console.error(result.error);
  } else {
    console.log("Login success", result.data);
    window.location.href = "dashboard.html";
  }
}

// =====================
// LOAD SUBJECTS
// =====================
async function loadSubjects() {
  var result = await supabase
    .from("subjects")
    .select("*");

  if (result.error) {
    console.error("Error loading subjects:", result.error);
    return;
  }

  var container = document.getElementById("subjectsContainer");
  if (!container) return;
  container.innerHTML = "";

  var uniqueSubjects = [];
  var subjectNames = [];

  result.data.forEach(function(subject) {
    if (!subjectNames.includes(subject.subject_name)) {
      subjectNames.push(subject.subject_name);
      uniqueSubjects.push(subject);
    }
  });

  uniqueSubjects.forEach(function(subject) {
    var div = document.createElement("div");
    div.className = "card";
    div.innerText = subject.subject_name;

    div.onclick = function() {
      localStorage.setItem("subject_id", subject.id);
      localStorage.setItem("subject_name", subject.subject_name);
      window.location.href = "attendance.html";
    };

    container.appendChild(div);
  });
}

// =====================
// LOAD STUDENTS
// =====================
async function loadStudents() {
  var subject_id = localStorage.getItem("subject_id");

  var result = await supabase
    .from("enrollments")
    .select("student_id, students(id, name)")
    .eq("subject_id", subject_id);

  if (result.error) {
    console.error("Error loading students:", result.error);
    return;
  }

  var list = document.getElementById("studentList");
  if (!list) return;
  list.innerHTML = "";

  result.data.forEach(function(item) {
    var student = item.students;
    var div = document.createElement("div");
    div.innerHTML = '<label><input type="checkbox" value="' + student.id + '"> ' + student.name + '</label>';
    list.appendChild(div);
  });

  loadExistingAttendance();
}

// =====================
// LOAD EXISTING ATTENDANCE
// =====================
async function loadExistingAttendance() {
  var subject_id = localStorage.getItem("subject_id");
  var today = getCurrentDateInUTC10();

  var result = await supabase
    .from("attendance")
    .select("student_id, status")
    .eq("subject_id", subject_id)
    .eq("attendance_date", today);

  if (result.error) {
    console.error("Error loading existing attendance:", result.error);
    return;
  }

  if (result.data && result.data.length > 0) {
    result.data.forEach(function(record) {
      if (record.status === "present") {
        var checkbox = document.querySelector("#studentList input[value='" + record.student_id + "']");
        if (checkbox) {
          checkbox.checked = true;
        }
      }
    });
    console.log("Loaded " + result.data.length + " existing attendance records for " + today);
  }
}

// =====================
// SUBMIT ATTENDANCE
// =====================
async function submitAttendance() {
  if (isSubmitting) {
    console.log("Already submitting...");
    return;
  }

  var subject_id = localStorage.getItem("subject_id");
  var subject_name = localStorage.getItem("subject_name");

  if (!subject_id) {
    alert("No subject selected.");
    return;
  }

  var checkboxes = document.querySelectorAll("#studentList input[type=checkbox]");
  var today = getCurrentDateInUTC10();

  var submitBtn = document.getElementById("submitBtn");
  var originalBtnText = submitBtn.innerHTML;

  isSubmitting = true;
  submitBtn.innerHTML = "Saving...";
  submitBtn.disabled = true;

  try {
    var deleteResult = await supabase
      .from("attendance")
      .delete()
      .eq("subject_id", subject_id)
      .eq("attendance_date", today);

    if (deleteResult.error) {
      alert("Error clearing previous attendance: " + deleteResult.error.message);
      return;
    }

    var records = [];
    checkboxes.forEach(function(cb) {
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

    var insertResult = await supabase
      .from("attendance")
      .insert(records);

    if (insertResult.error) {
      alert("Error saving attendance: " + insertResult.error.message);
    } else {
      alert("✅ Attendance for " + subject_name + " saved successfully! (" + records.length + " students) for " + today);
    }
  } catch (err) {
    console.error("Error:", err);
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
// DAILY ATTENDANCE REPORT
// =====================
async function viewAttendanceReport() {
  var subject_id = localStorage.getItem("subject_id");
  var subject_name = localStorage.getItem("subject_name");
  var today = getCurrentDateInUTC10();
  var displayDate = formatDateInUTC10(today);

  if (!subject_id) {
    alert("No subject selected.");
    return;
  }

  var result = await supabase
    .from("attendance")
    .select("status, students(name)")
    .eq("subject_id", subject_id)
    .eq("attendance_date", today);

  if (result.error) {
    alert("Error loading report: " + result.error.message);
    return;
  }

  if (!result.data || result.data.length === 0) {
    alert("No attendance records for " + subject_name + " on " + displayDate);
    return;
  }

  var presentStudents = [];
  var absentStudents = [];

  result.data.forEach(function(r) {
    if (r.status === "present") {
      presentStudents.push(r.students.name);
    } else {
      absentStudents.push(r.students.name);
    }
  });

  var message = "📋 DAILY ATTENDANCE REPORT (UTC+10:00)\n";
  message += "Subject: " + subject_name + "\n";
  message += "Date: " + displayDate + "\n";
  message += "------------------------\n\n";
  message += "✅ PRESENT (" + presentStudents.length + "):\n";
  message += presentStudents.join("\n") || "None\n";
  message += "\n\n❌ ABSENT (" + absentStudents.length + "):\n";
  message += absentStudents.join("\n") || "None\n";
  message += "\n\n------------------------\n";
  message += "📊 Total: " + result.data.length;
  message += "\n📈 Rate: " + Math.round((presentStudents.length / result.data.length) * 100) + "%";

  alert(message);
}

// =====================
// WEEKLY ATTENDANCE SUMMARY
// =====================
async function weeklyAttendanceSummary() {
  var subject_id = localStorage.getItem("subject_id");
  var subject_name = localStorage.getItem("subject_name");

  if (!subject_id) {
    alert("No subject selected.");
    return;
  }

  var btn = document.getElementById("weeklyReportBtn");
  var originalText = btn.innerHTML;
  btn.innerHTML = "Loading...";
  btn.disabled = true;

  try {
    var weekDates = getWeekDatesInUTC10();
    var startDate = weekDates.monday;
    var endDate = weekDates.friday;

    var studentsResult = await supabase
      .from("enrollments")
      .select("student_id, students(id, name)")
      .eq("subject_id", subject_id);

    if (studentsResult.error) {
      alert("Error loading students: " + studentsResult.error.message);
      return;
    }

    var students = [];
    studentsResult.data.forEach(function(item) {
      students.push({ id: item.student_id, name: item.students.name });
    });

    var attendanceResult = await supabase
      .from("attendance")
      .select("student_id, attendance_date, status")
      .eq("subject_id", subject_id)
      .gte("attendance_date", startDate)
      .lte("attendance_date", endDate);

    if (attendanceResult.error) {
      alert("Error loading attendance: " + attendanceResult.error.message);
      return;
    }

    var attendanceMap = {};
    if (attendanceResult.data) {
      attendanceResult.data.forEach(function(record) {
        if (!attendanceMap[record.student_id]) {
          attendanceMap[record.student_id] = {};
        }
        attendanceMap[record.student_id][record.attendance_date] = record.status;
      });
    }

    var weekDateStrs = [];
    var monday = new Date(startDate + "T12:00:00");
    for (var i = 0; i < 5; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDateStrs.push(d.toISOString().split("T")[0]);
    }
    
    var dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];

    var message = "📅 WEEKLY ATTENDANCE SUMMARY (UTC+10:00)\n";
    message += "========================================\n";
    message += "Subject: " + subject_name + "\n";
    message += "Week: " + weekDates.mondayDisplay + " to " + weekDates.fridayDisplay + "\n";
    message += "========================================\n\n";
    message += "Student".padEnd(20);
    for (var d = 0; d < dayNames.length; d++) {
      message += dayNames[d].padEnd(6);
    }
    message += "Total   %\n";
    message += "----------------------------------------\n";

    var totalPresentAll = 0;
    var totalDaysAll = 0;

    students.forEach(function(student) {
      var row = student.name.substring(0, 18).padEnd(20);
      var presentCount = 0;
      var daysRecorded = 0;

      for (var i = 0; i < weekDateStrs.length; i++) {
        var status = attendanceMap[student.id] && attendanceMap[student.id][weekDateStrs[i]];
        if (status === "present") {
          row += "✓     ";
          presentCount++;
          daysRecorded++;
        } else if (status === "absent") {
          row += "✗     ";
          daysRecorded++;
        } else {
          row += "?     ";
        }
      }

      var percent = daysRecorded > 0 ? Math.round((presentCount / daysRecorded) * 100) : 0;
      row += presentCount + "/" + daysRecorded + "   " + percent + "%";
      message += row + "\n";

      totalPresentAll += presentCount;
      totalDaysAll += daysRecorded;
    });

    var overallPercent = totalDaysAll > 0 ? Math.round((totalPresentAll / totalDaysAll) * 100) : 0;
    message += "\n----------------------------------------\n";
    message += "📊 Class Overall: " + totalPresentAll + "/" + totalDaysAll + " (" + overallPercent + "%)\n";

    alert(message);
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// =====================
// CUMULATIVE ATTENDANCE REPORT
// =====================
async function cumulativeAttendanceReport() {
  var subject_id = localStorage.getItem("subject_id");
  var subject_name = localStorage.getItem("subject_name");

  if (!subject_id) {
    alert("No subject selected.");
    return;
  }

  var btn = document.getElementById("cumulativeReportBtn");
  var originalText = btn.innerHTML;
  btn.innerHTML = "Loading...";
  btn.disabled = true;

  try {
    var semester = getSemesterInUTC10();

    var studentsResult = await supabase
      .from("enrollments")
      .select("student_id, students(id, name)")
      .eq("subject_id", subject_id);

    if (studentsResult.error) {
      alert("Error loading students: " + studentsResult.error.message);
      return;
    }

    if (!studentsResult.data || studentsResult.data.length === 0) {
      alert("No students enrolled in this subject.");
      return;
    }

    var cumulativeResult = await supabase
      .from("cumulative_attendance")
      .select("*")
      .eq("subject_id", subject_id)
      .eq("semester", semester);

    if (cumulativeResult.error) {
      alert("Error loading cumulative data: " + cumulativeResult.error.message);
      return;
    }

    var cumulativeMap = {};
    if (cumulativeResult.data) {
      cumulativeResult.data.forEach(function(record) {
        cumulativeMap[record.student_id] = record;
      });
    }

    var message = "📊 CUMULATIVE ATTENDANCE REPORT (UTC+10:00)\n";
    message += "========================================\n";
    message += "Subject: " + subject_name + "\n";
    message += "Semester: " + semester + "\n";
    message += "Generated: " + new Date().toLocaleString("en-US", { timeZone: "Pacific/Port_Moresby" }) + "\n";
    message += "========================================\n\n";
    message += "Student Name".padEnd(25);
    message += "Present".padEnd(10);
    message += "Absent".padEnd(10);
    message += "Total".padEnd(8);
    message += "Rate%\n";
    message += "----------------------------------------\n";

    var totalPresentAll = 0;
    var totalClassesAll = 0;

    studentsResult.data.forEach(function(item) {
      var student = item.students;
      var cum = cumulativeMap[student.id];

      var present = cum ? cum.total_present : 0;
      var absent = cum ? cum.total_absences : 0;
      var total = cum ? cum.total_classes : 0;
      var rate = total > 0 ? Math.round((present / total) * 100) : 0;

      var row = student.name.substring(0, 22).padEnd(25);
      row += present.toString().padEnd(10);
      row += absent.toString().padEnd(10);
      row += total.toString().padEnd(8);
      row += rate + "%";

      message += row + "\n";

      totalPresentAll += present;
      totalClassesAll += total;
    });

    var overallRate = totalClassesAll > 0 ? Math.round((totalPresentAll / totalClassesAll) * 100) : 0;
    message += "\n----------------------------------------\n";
    message += "📊 Class Overall: " + totalPresentAll + "/" + totalClassesAll + " (" + overallRate + "%)\n";
    message += "📅 Semester: " + semester + "\n";

    alert(message);

    if (confirm("Save this cumulative report as a text file?")) {
      var blob = new Blob([message], { type: "text/plain" });
      var link = document.createElement("a");
      var url = URL.createObjectURL(blob);
      link.href = url;
      link.download = "Cumulative_Attendance_" + subject_name.replace(/[^a-zA-Z0-9]/g, '_') + "_" + semester + ".txt";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// =====================
// EXPORT FUNCTIONS
// =====================
async function exportToPDF() {
  alert("📄 PDF export feature ready.");
}

async function exportToExcel() {
  alert("📊 Excel export feature ready.");
}

async function exportToWord() {
  alert("📝 Word export feature ready.");
}

// =====================
// STUDENT RECORDS PAGE FUNCTIONS
// =====================

var currentSubjectId = null;
var currentStudentId = null;
var currentAttendanceData = [];

async function loadSubjectsForRecords() {
  var subjectSelect = document.getElementById("subjectSelect");
  if (!subjectSelect) return;
  
  subjectSelect.innerHTML = '<option value="">-- Select a subject --</option>';
  
  var result = await supabase
    .from("subjects")
    .select("*");
  
  if (result.error) {
    console.error("Error loading subjects:", result.error);
    return;
  }
  
  var uniqueSubjects = [];
  var subjectNames = [];
  
  result.data.forEach(function(subject) {
    if (!subjectNames.includes(subject.subject_name)) {
      subjectNames.push(subject.subject_name);
      uniqueSubjects.push(subject);
    }
  });
  
  uniqueSubjects.forEach(function(subject) {
    var option = document.createElement("option");
    option.value = subject.id;
    option.textContent = subject.subject_name;
    subjectSelect.appendChild(option);
  });
}

async function loadStudentsForSubject(subjectId) {
  var studentSelect = document.getElementById("studentSelect");
  if (!studentSelect) return;
  
  studentSelect.innerHTML = '<option value="">-- Select a student --</option>';
  studentSelect.disabled = true;
  
  if (!subjectId) return;
  
  var result = await supabase
    .from("enrollments")
    .select("student_id, students(id, name)")
    .eq("subject_id", subjectId);
  
  if (result.error) {
    console.error("Error loading students:", result.error);
    return;
  }
  
  result.data.forEach(function(item) {
    var student = item.students;
    var option = document.createElement("option");
    option.value = student.id;
    option.textContent = student.name;
    studentSelect.appendChild(option);
  });
  
  studentSelect.disabled = false;
}

async function loadStudentAttendanceHistory(studentId, subjectId) {
  if (!studentId || !subjectId) return;
  
  var tableBody = document.getElementById("attendanceTableBody");
  if (tableBody) {
    tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Loading records...<\/td><\/tr>';
  }
  
  var result = await supabase
    .from("attendance")
    .select("attendance_date, status")
    .eq("student_id", studentId)
    .eq("subject_id", subjectId)
    .order("attendance_date", { ascending: false });
  
  if (result.error) {
    console.error("Error loading attendance:", result.error);
    alert("Error loading attendance records: " + result.error.message);
    return;
  }
  
  currentAttendanceData = result.data || [];
  
  var semester = getSemesterInUTC10();
  
  var cumulativeResult = await supabase
    .from("cumulative_attendance")
    .select("*")
    .eq("student_id", studentId)
    .eq("subject_id", subjectId)
    .eq("semester", semester);
  
  if (!cumulativeResult.error && cumulativeResult.data && cumulativeResult.data.length > 0) {
    var cum = cumulativeResult.data[0];
    document.getElementById("totalPresent").textContent = cum.total_present || 0;
    document.getElementById("totalAbsent").textContent = cum.total_absences || 0;
    document.getElementById("totalClasses").textContent = cum.total_classes || 0;
    var rate = cum.total_classes > 0 ? Math.round((cum.total_present / cum.total_classes) * 100) : 0;
    document.getElementById("attendanceRate").textContent = rate + "%";
  } else {
    document.getElementById("totalPresent").textContent = "0";
    document.getElementById("totalAbsent").textContent = "0";
    document.getElementById("totalClasses").textContent = "0";
    document.getElementById("attendanceRate").textContent = "0%";
  }
  
  var studentResult = await supabase
    .from("students")
    .select("name")
    .eq("id", studentId)
    .single();
  
  if (!studentResult.error) {
    document.getElementById("studentNameDisplay").textContent = studentResult.data.name;
    document.getElementById("studentSemester").textContent = "Semester: " + semester + " (UTC+10:00)";
    document.getElementById("studentInfo").style.display = "block";
  }
  
  displayAttendanceTable(currentAttendanceData);
}

function displayAttendanceTable(attendanceData) {
  var tableBody = document.getElementById("attendanceTableBody");
  if (!tableBody) return;
  
  if (!attendanceData || attendanceData.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No attendance records found for this student<\/td><\/tr>';
    return;
  }
  
  tableBody.innerHTML = "";
  var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  attendanceData.forEach(function(record) {
    var row = tableBody.insertRow();
    var formattedDate = formatDateInUTC10(record.attendance_date);
    row.insertCell(0).textContent = formattedDate;
    var statusCell = row.insertCell(1);
    statusCell.textContent = record.status === "present" ? "✓ Present" : "✗ Absent";
    statusCell.className = record.status === "present" ? "status-present" : "status-absent";
    
    try {
      var dateObj = new Date(record.attendance_date + "T12:00:00");
      var utc10Day = new Date(dateObj.toLocaleString("en-US", { timeZone: "Pacific/Port_Moresby" }));
      row.insertCell(2).textContent = days[utc10Day.getDay()];
    } catch (e) {
      row.insertCell(2).textContent = "-";
    }
  });
}

async function exportStudentToPDF() {
  if (!currentStudentId || !currentSubjectId) {
    alert("Please select a student first.");
    return;
  }
  
  var studentName = document.getElementById("studentNameDisplay").textContent;
  var subjectSelect = document.getElementById("subjectSelect");
  var subjectName = subjectSelect.options[subjectSelect.selectedIndex]?.text || "Unknown";
  var present = document.getElementById("totalPresent").textContent;
  var absent = document.getElementById("totalAbsent").textContent;
  var total = document.getElementById("totalClasses").textContent;
  var rate = document.getElementById("attendanceRate").textContent;
  
  var htmlContent = '<div style="font-family: Arial, sans-serif; padding: 40px;">' +
    '<h1 style="text-align: center; color: #667eea;">STUDENT ATTENDANCE RECORD</h1><hr>' +
    '<p><strong>Student Name:</strong> ' + studentName + '</p>' +
    '<p><strong>Subject:</strong> ' + subjectName + '</p>' +
    '<p><strong>Generated:</strong> ' + new Date().toLocaleString("en-US", { timeZone: "Pacific/Port_Moresby" }) + '</p>' +
    '<p><strong>Timezone:</strong> UTC+10:00 (Papua New Guinea)</p><hr>' +
    '<h3>Summary</h3>' +
    '<table style="width: 100%; border-collapse: collapse;">' +
    '<tr style="background: #667eea; color: white;"><th style="padding: 10px;">Total Present</th><th style="padding: 10px;">Total Absent</th><th style="padding: 10px;">Total Classes</th><th style="padding: 10px;">Attendance Rate</th><\/tr>' +
    '<tr style="text-align: center;"><td style="padding: 10px;">' + present + '<\/td><td style="padding: 10px;">' + absent + '<\/td><td style="padding: 10px;">' + total + '<\/td><td style="padding: 10px;">' + rate + '<\/td><\/tr>' +
    '<\/table><h3>Attendance History</h3>' +
    '<table style="width: 100%; border-collapse: collapse;"><tr style="background: #667eea; color: white;"><th style="padding: 10px;">Date</th><th style="padding: 10px;">Status</th><\/tr>';
  
  currentAttendanceData.forEach(function(record) {
    var displayDate = formatDateInUTC10(record.attendance_date);
    htmlContent += '<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">' + displayDate + '<\/td>' +
      '<td style="padding: 8px; border-bottom: 1px solid #ddd; color: ' + (record.status === 'present' ? '#27ae60' : '#e74c3c') + '">' + (record.status === 'present' ? 'Present' : 'Absent') + '<\/td><\/tr>';
  });
  
  htmlContent += '<\/table><p style="margin-top: 40px; text-align: center; font-size: 12px; color: #999;">Generated by Web Attendance System (UTC+10:00)</p></div>';
  
  var element = document.createElement('div');
  element.innerHTML = htmlContent;
  document.body.appendChild(element);
  
  var opt = { margin: [0.5, 0.5, 0.5, 0.5], filename: studentName + "_Attendance_Record.pdf", image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } };
  
  await html2pdf().set(opt).from(element).save();
  document.body.removeChild(element);
  alert("PDF exported successfully!");
}

async function exportStudentToExcel() {
  if (!currentStudentId || !currentSubjectId) {
    alert("Please select a student first.");
    return;
  }
  
  var studentName = document.getElementById("studentNameDisplay").textContent;
  var subjectSelect = document.getElementById("subjectSelect");
  var subjectName = subjectSelect.options[subjectSelect.selectedIndex]?.text || "Unknown";
  var present = document.getElementById("totalPresent").textContent;
  var absent = document.getElementById("totalAbsent").textContent;
  var total = document.getElementById("totalClasses").textContent;
  var rate = document.getElementById("attendanceRate").textContent;
  
  var excelData = [["STUDENT ATTENDANCE RECORD"], ["Student Name:", studentName], ["Subject:", subjectName], ["Generated:", new Date().toLocaleString("en-US", { timeZone: "Pacific/Port_Moresby" })], ["Timezone:", "UTC+10:00 (Papua New Guinea)"], [], ["SUMMARY"], ["Total Present", present], ["Total Absent", absent], ["Total Classes", total], ["Attendance Rate", rate], [], ["ATTENDANCE HISTORY"], ["Date", "Status"]];
  
  currentAttendanceData.forEach(function(record) {
    var displayDate = formatDateInUTC10(record.attendance_date);
    excelData.push([displayDate, record.status === "present" ? "PRESENT" : "ABSENT"]);
  });
  
  var ws = XLSX.utils.aoa_to_sheet(excelData);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance Record");
  XLSX.writeFile(wb, studentName + "_Attendance_Record.xlsx");
  alert("Excel exported successfully!");
}

function initStudentRecordsPage() {
  var subjectSelect = document.getElementById("subjectSelect");
  if (subjectSelect) {
    subjectSelect.addEventListener("change", function() {
      currentSubjectId = this.value;
      loadStudentsForSubject(currentSubjectId);
      currentStudentId = null;
      document.getElementById("studentInfo").style.display = "none";
      document.getElementById("attendanceTableBody").innerHTML = '<tr><td colspan="3" style="text-align: center;">Select a student to view records<\/td><\/tr>';
      document.getElementById("totalPresent").textContent = "0";
      document.getElementById("totalAbsent").textContent = "0";
      document.getElementById("totalClasses").textContent = "0";
      document.getElementById("attendanceRate").textContent = "0%";
    });
  }
  
  var studentSelect = document.getElementById("studentSelect");
  if (studentSelect) {
    studentSelect.addEventListener("change", function() {
      currentStudentId = this.value;
      if (currentStudentId && currentSubjectId) {
        loadStudentAttendanceHistory(currentStudentId, currentSubjectId);
      }
    });
  }
  
  var exportPdfBtn = document.getElementById("exportStudentPdfBtn");
  if (exportPdfBtn) exportPdfBtn.addEventListener("click", exportStudentToPDF);
  
  var exportExcelBtn = document.getElementById("exportStudentExcelBtn");
  if (exportExcelBtn) exportExcelBtn.addEventListener("click", exportStudentToExcel);
  
  loadSubjectsForRecords();
}

// =====================
// PAGE LOAD
// =====================
document.addEventListener("DOMContentLoaded", function() {
  console.log("Page loaded: " + window.location.pathname);

  if (window.location.pathname.includes("dashboard.html")) {
    loadSubjects();
  }

  if (window.location.pathname.includes("attendance.html")) {
    var title = document.getElementById("subjectTitle");
    if (title) {
      title.innerText = localStorage.getItem("subject_name");
    }
    loadStudents();

    var submitBtn = document.getElementById("submitBtn");
    if (submitBtn) submitBtn.addEventListener("click", submitAttendance);

    var reportBtn = document.getElementById("viewReportBtn");
    if (reportBtn) reportBtn.addEventListener("click", viewAttendanceReport);

    var weeklyBtn = document.getElementById("weeklyReportBtn");
    if (weeklyBtn) weeklyBtn.addEventListener("click", weeklyAttendanceSummary);

    var cumulativeBtn = document.getElementById("cumulativeReportBtn");
    if (cumulativeBtn) cumulativeBtn.addEventListener("click", cumulativeAttendanceReport);

    var pdfBtn = document.getElementById("exportPdfBtn");
    if (pdfBtn) pdfBtn.addEventListener("click", exportToPDF);

    var excelBtn = document.getElementById("exportExcelBtn");
    if (excelBtn) excelBtn.addEventListener("click", exportToExcel);

    var wordBtn = document.getElementById("exportWordBtn");
    if (wordBtn) wordBtn.addEventListener("click", exportToWord);
  }

  if (window.location.pathname.includes("student_records.html")) {
    initStudentRecordsPage();
  }
});
