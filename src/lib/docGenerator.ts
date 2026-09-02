/**
 * Generates and downloads a rich, styled Microsoft Word Document (.doc) containing
 * complete download, installation, demo login credentials, and user workflow instructions.
 */

export function downloadWordDocInstructions(): void {
  const currentOrigin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://portal.llctimetracker.com';

  const docHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:w="urn:schemas-microsoft-com:office:word" 
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>LLC Time Tracker - Download, Login & User Guide</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1E293B;
      background-color: #FFFFFF;
      margin: 36pt 48pt;
    }
    h1 {
      font-size: 22pt;
      color: #1E3A8A;
      font-weight: 700;
      border-bottom: 2pt solid #2563EB;
      padding-bottom: 6pt;
      margin-top: 0;
      margin-bottom: 12pt;
    }
    h2 {
      font-size: 15pt;
      color: #1E40AF;
      font-weight: 600;
      margin-top: 18pt;
      margin-bottom: 8pt;
      border-bottom: 1pt solid #E2E8F0;
      padding-bottom: 4pt;
    }
    h3 {
      font-size: 12pt;
      color: #0F172A;
      font-weight: 600;
      margin-top: 12pt;
      margin-bottom: 4pt;
    }
    p, li {
      font-size: 10.5pt;
      color: #334155;
    }
    .badge {
      background-color: #EFF6FF;
      color: #1D4ED8;
      font-weight: bold;
      padding: 2pt 6pt;
      border-radius: 4pt;
      border: 1pt solid #BFDBFE;
      font-size: 9pt;
      display: inline-block;
    }
    .badge-pht {
      background-color: #F0FDF4;
      color: #15803D;
      font-weight: bold;
      padding: 2pt 6pt;
      border-radius: 4pt;
      border: 1pt solid #BBF7D0;
      font-size: 9pt;
      display: inline-block;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10pt 0 16pt 0;
      font-size: 10pt;
    }
    th {
      background-color: #F1F5F9;
      color: #0F172A;
      font-weight: bold;
      text-align: left;
      padding: 8pt;
      border: 1pt solid #CBD5E1;
    }
    td {
      padding: 7pt 8pt;
      border: 1pt solid #CBD5E1;
      color: #334155;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background-color: #F8FAFC;
    }
    .highlight-box {
      background-color: #F0F9FF;
      border-left: 4pt solid #0284C7;
      padding: 10pt 14pt;
      margin: 12pt 0;
      border-radius: 0 6pt 6pt 0;
    }
    .warning-box {
      background-color: #FFFBEB;
      border-left: 4pt solid #F59E0B;
      padding: 10pt 14pt;
      margin: 12pt 0;
      border-radius: 0 6pt 6pt 0;
    }
    code {
      font-family: 'Consolas', 'Courier New', monospace;
      background-color: #F1F5F9;
      padding: 1pt 4pt;
      border-radius: 3pt;
      color: #0F172A;
      font-size: 9.5pt;
    }
    ol, ul {
      margin-top: 4pt;
      margin-bottom: 10pt;
      padding-left: 20pt;
    }
    li {
      margin-bottom: 4pt;
    }
    .footer {
      margin-top: 30pt;
      padding-top: 10pt;
      border-top: 1pt solid #CBD5E1;
      font-size: 9pt;
      color: #64748B;
      text-align: center;
    }
  </style>
</head>
<body>

  <h1>LLC Time Tracker - Download, Login & User Guide</h1>
  
  <p><strong>System Version:</strong> v1.0 Production Edition<br>
  <strong>Primary Timezone:</strong> <span class="badge-pht">Asia/Manila (PHT / UTC+8)</span><br>
  <strong>Web Portal URL:</strong> <code>${currentOrigin}</code></p>

  <div class="highlight-box">
    <strong>Overview:</strong> LLC Time Tracker is an enterprise-grade agent time tracking, activity surveillance, timesheet management, and payroll calculation platform designed for virtual assistant agencies and remote teams.
  </div>

  <h2>1. How to Access the System</h2>

  <h3>Option A: Web Portal (Zero Installation)</h3>
  <p>Simply open any modern browser (Chrome, Edge, Safari, Firefox) and navigate to the application URL:</p>
  <p><code>${currentOrigin}</code></p>

  <h3>Option B: Standalone Desktop Software (Windows / macOS / Linux)</h3>
  <p>For native background tracking, auto-start, and desktop convenience, you can download the automated builder:</p>
  <ol>
    <li>Click the <strong>Download Software</strong> button in the top right navigation bar or login screen.</li>
    <li>Select your Operating System:
      <ul>
        <li><strong>Windows:</strong> Downloads <code>Build_LLC_Time_Tracker_Windows.bat</code></li>
        <li><strong>macOS:</strong> Downloads <code>Build_LLC_Time_Tracker_Mac.sh</code></li>
        <li><strong>Linux:</strong> Downloads <code>Build_LLC_Time_Tracker_Linux.sh</code></li>
      </ul>
    </li>
    <li>Place the builder file into any folder on your computer (e.g. <code>Desktop/LLC-Tracker/</code>).</li>
    <li>Run the builder script:
      <ul>
        <li><strong>Windows:</strong> Double-click the <code>.bat</code> file.</li>
        <li><strong>macOS/Linux:</strong> Open Terminal, run <code>bash Build_LLC_Time_Tracker_Mac.sh</code>.</li>
      </ul>
    </li>
    <li>The script will automatically compile your native standalone application (<code>LLC Time Tracker.exe</code> or <code>LLC Time Tracker.app</code>).</li>
  </ol>

  <h2>2. System Login & Username Naming Convention</h2>
  <p>To provide clean, professional, and memorable logins for every team member, LLC Time Tracker uses an automated unique username convention alongside employee code authentication:</p>

  <div class="highlight-box">
    <strong>Standard Username Rule:</strong>
    <ul>
      <li><strong>Formula:</strong> First initial of first name + first 4 letters of last name (e.g. <strong>Juan David</strong> &rarr; <code>jdavi</code>).</li>
      <li><strong>Automatic Collision Handling:</strong> If another staff member shares the same base username (e.g. <code>jdavi</code>), the system automatically uses the 5th letter of the last name (&rarr; <code>jdavid</code>), then the 6th letter (&rarr; <code>jdavids</code>), ensuring complete uniqueness without conflicts.</li>
      <li><strong>Login Flexibility:</strong> Employees can sign in using either their <strong>Username</strong> (e.g. <code>jdavid</code>), their <strong>Employee Code</strong> (e.g. <code>0001</code> or <code>LLC-0001</code>), or their company email.</li>
    </ul>
  </div>

  <table>
    <thead>
      <tr>
        <th>Role</th>
        <th>Full Name</th>
        <th>Username</th>
        <th>Employee Code</th>
        <th>Default Password</th>
        <th>Key Permissions</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="badge">Super Admin</span></td>
        <td><strong>Admin</strong></td>
        <td><code>admin</code></td>
        <td><code>SuperAdmin</code></td>
        <td><code>AdminpassW0rd123!</code></td>
        <td>Full Access, Directory, Google Sheets Sync, Financials, All Logs</td>
      </tr>
      <tr>
        <td><span class="badge">VA Admin</span></td>
        <td><strong>Daniel Vance</strong></td>
        <td><code>dvanc</code></td>
        <td><code>LLC-0002</code></td>
        <td><code>admin123</code></td>
        <td>Department Management, Team Allocations, Live Board, Directory</td>
      </tr>
      <tr>
        <td><span class="badge">Trainer / Supervisor</span></td>
        <td><strong>Elena Rostova</strong></td>
        <td><code>erost</code></td>
        <td><code>LLC-0003</code></td>
        <td><code>trainer123</code></td>
        <td>Live Agent Dashboard, Real-time Task Oversight, Screenshot Review</td>
      </tr>
      <tr>
        <td><span class="badge">Team Leader</span></td>
        <td><strong>Marcus Thorne</strong></td>
        <td><code>mthor</code></td>
        <td><code>LLC-0004</code></td>
        <td><code>lead123</code></td>
        <td>Team Member Timesheet Approval, Active Shift Monitoring</td>
      </tr>
      <tr>
        <td><span class="badge">HR Manager</span></td>
        <td><strong>Rachel Green</strong></td>
        <td><code>rgree</code></td>
        <td><code>LLC-0005</code></td>
        <td><code>hr123</code></td>
        <td>Employee Directory, Leave Approvals, Onboarding & Rate Setup</td>
      </tr>
      <tr>
        <td><span class="badge">Payroll Officer</span></td>
        <td><strong>David Miller</strong></td>
        <td><code>dmill</code></td>
        <td><code>LLC-0006</code></td>
        <td><code>payroll123</code></td>
        <td>Salary Disbursement, Deductions, Pay Slip Generation, Rate Review</td>
      </tr>
      <tr>
        <td><span class="badge">Virtual Assistant</span></td>
        <td><strong>Alex Mercer</strong></td>
        <td><code>amerc</code></td>
        <td><code>LLC-0007</code></td>
        <td><code>agent123</code></td>
        <td>Desktop Tracker, Task Selection, Break Manager, My Timesheet</td>
      </tr>
      <tr>
        <td><span class="badge">Virtual Assistant</span></td>
        <td><strong>Maria Santos</strong></td>
        <td><code>msant</code></td>
        <td><code>LLC-0008</code></td>
        <td><code>agent123</code></td>
        <td>Agent Dashboard, Time Logging, Shift History</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Standalone Desktop App: macOS Compatibility & Zero-Redownload Updates</h2>
  
  <div class="highlight-box">
    <strong>Apple / macOS Compatibility:</strong><br>
    The desktop software is 100% compatible with macOS, supporting both <strong>Apple Silicon (M1, M2, M3, M4 chips)</strong> and <strong>Intel Macs</strong>. Mac users can download <code>Build_LLC_Time_Tracker_Mac.sh</code> and double-click <code>Launch_LLC_Time_Tracker.command</code> to launch immediately.
  </div>

  <div class="highlight-box">
    <strong>Over-The-Air Desktop Updates (No Re-downloading Required!):</strong><br>
    Because the standalone desktop application utilizes an embedded native Electron window connected to the cloud engine, <strong>users NEVER need to re-download the desktop application when system features or updates are deployed</strong>.
    <ul>
      <li>When a new version or user update is pushed, the desktop app automatically detects the release and displays an <strong>"Update Available - Click to Sync"</strong> notification.</li>
      <li>Clicking the prompt (or pressing <code>Cmd+R</code> / <code>Ctrl+R</code>) reloads the interface with the latest features instantly!</li>
    </ul>
  </div>

  <h2>4. Core Features & User Instructions</h2>

  <h3>A. Clocking In & Time Tracking (For Agents)</h3>
  <ol>
    <li>Log into your agent account.</li>
    <li>Navigate to <strong>Desktop Tracker</strong> or your <strong>Agent Dashboard</strong>.</li>
    <li>Select your <strong>Designation</strong> (e.g. <em>Real Estate VA, Cold Caller, Bookkeeper</em>).</li>
    <li>Select your <strong>Active Task</strong> (e.g. <em>Lead Generation, CRM Data Entry, Cold Calling</em>).</li>
    <li>Click the green <strong>Start Tracking</strong> button.</li>
    <li>When stepping away for lunch or personal errands, click <strong>Break / Pause</strong>.</li>
    <li>When your work shift is finished, click <strong>Stop & Save Log</strong>.</li>
  </ol>

  <div class="warning-box">
    <strong>Idle Alert System:</strong> If no keyboard or mouse activity is detected for 5 consecutive minutes while tracking, a pop-up alert will appear asking if you were working or away. Idle time can be automatically deducted or assigned based on supervisor policies.
  </div>

  <h3>B. Activity Surveillance & Input Tracking Controls</h3>
  <ul>
    <li><strong>Activity Surveillance Toggle:</strong> Admins and HR can configure whether an employee's mouse and keyboard meters are tracked via the Employee Directory.</li>
    <li><strong>When Monitored:</strong> Real-time activity percentage (0-100%) is recorded alongside periodic random desktop screenshots.</li>
    <li><strong>When Surveillance is OFF:</strong> Mouse and keyboard activity tracking is disabled, and displays as <em>"Monitoring OFF"</em> across all supervisor boards.</li>
  </ul>

  <h3>C. Philippine Timezone (Asia/Manila PHT / UTC+8)</h3>
  <ul>
    <li>All daily timesheets, attendance logs, and live shifts operate on <strong>Philippine Time (PHT)</strong>.</li>
    <li>Live agent cards display real-time Manila clock hours (e.g. <code>PHT 11:40 AM</code>).</li>
    <li>Daily totals are clearly shown in hours and minutes (e.g. <code>Today: 2h 15m</code>).</li>
  </ul>

  <h3>D. Leave Requests & Approvals</h3>
  <ol>
    <li>Navigate to the <strong>Leave Requests</strong> tab.</li>
    <li>Click <strong>Request Leave / Time-Off</strong>.</li>
    <li>Select your leave type (Vacation, Sick Leave, Emergency, Unpaid).</li>
    <li>Choose your Start Date and End Date (PHT) and enter a reason.</li>
    <li>HR Managers and Supervisors will review and approve the request in real time.</li>
  </ol>

  <h3>E. Google Sheets 2-Way Live Sync (Admins Only)</h3>
  <ol>
    <li>Go to the <strong>System Audit & Sheets</strong> tab or click <strong>Google Sheets Sync</strong> in the top bar.</li>
    <li>Paste your Google Apps Script Webhook URL or Google Spreadsheet link.</li>
    <li>Click <strong>Sync Now</strong> to push all real-time attendance, time logs, and employee profiles directly to Google Sheets!</li>
  </ol>

  <div class="footer">
    © LLC Time Tracker • Enterprise Workforce Management Solution • Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
  </div>

</body>
</html>
  `;

  // Create Word Document Blob using standard Word MIME type
  const blob = new Blob(['\ufeff' + docHtml], {
    type: 'application/msword;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = 'LLC_Time_Tracker_User_Guide_and_Login_Demo.doc';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}
