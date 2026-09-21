// Replace these two values with the same Supabase project used by the server.
const SUPABASE_URL = "https://sagntfskpsyrwhzgtuzm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tfBwDmxzJr8kpWmU7IW3gg_pRJ0VJpi";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showMessage(el, text, error=false) {
  el.textContent = text;
  el.className = `message show${error ? " error" : ""}`;
}

async function submitForm(formId, endpoint, messageId, successText) {
  const form = document.getElementById(formId);
  const message = document.getElementById(messageId);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    message.className = "message";
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Submitting...";
    try {
      const response = await fetch(endpoint, { method: "POST", body: new FormData(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Submission failed.");
      showMessage(message, `${successText} Your registration ID is ${data.registration_code}. Please keep it safe.`);
      form.reset();
    } catch (err) {
      showMessage(message, err.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "Submit Registration";
    }
  });
}

submitForm("playerForm", "/api/register/player", "playerMessage", "Player registration successful!");
submitForm("managementForm", "/api/register/management", "managementMessage", "Management registration successful!");

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const dashboard = document.getElementById("dashboard");
const loginBox = document.getElementById("loginBox");
const dashboardContent = document.getElementById("dashboardContent");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const { error } = await sb.auth.signInWithPassword({
      email: document.getElementById("adminEmail").value,
      password: document.getElementById("adminPassword").value
    });
    if (error) throw error;
    await loadDashboard("players");
  } catch (err) {
    showMessage(loginMessage, err.message, true);
  }
});

document.getElementById("logout").addEventListener("click", async () => {
  await sb.auth.signOut();
  dashboard.hidden = true;
  loginBox.hidden = false;
});

document.querySelectorAll(".tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    loadDashboard(btn.dataset.tab);
  });
});

async function loadDashboard(tab) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { data: admin } = await sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) {
    showMessage(loginMessage, "This account is not authorized as an All Stars administrator.", true);
    await sb.auth.signOut();
    return;
  }
  loginBox.hidden = true;
  dashboard.hidden = false;

  const table = tab === "players" ? "player_registrations" : "management_registrations";
  const { data, error } = await sb.from(table).select("*").order("created_at", { ascending: false });
  if (error) {
    dashboardContent.innerHTML = `<p class="message show error">${escapeHtml(error.message)}</p>`;
    return;
  }

  const rows = data || [];
  dashboardContent.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Registration</th><th>Name</th><th>${tab === "players" ? "Category" : "Role"}</th>
          <th>Phone</th><th>Date</th><th>Status</th><th>Action</th>
        </tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${escapeHtml(row.registration_code)}</td>
              <td>${escapeHtml(row.full_name)}</td>
              <td>${escapeHtml(tab === "players" ? row.player_category : row.role)}</td>
              <td>${escapeHtml(row.phone)}</td>
              <td>${new Date(row.created_at).toLocaleDateString()}</td>
              <td class="status ${escapeHtml(row.status)}">${escapeHtml(row.status)}</td>
              <td class="admin-actions">
                <button onclick="setStatus('${tab}','${row.registration_id}','Approved')">Approve</button>
                <button onclick="setStatus('${tab}','${row.registration_id}','Rejected')">Reject</button>
                <button onclick='makeRegistrationPdf(${JSON.stringify(row).replace(/'/g, "&#39;")}, "${tab === "players" ? "player" : "management"}")'>PDF</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

window.setStatus = async (tab, id, status) => {
  const table = tab === "players" ? "player_registrations" : "management_registrations";
  const { error } = await sb.from(table).update({ status }).eq("registration_id", id);
  if (error) alert(error.message);
  else loadDashboard(tab);
};


function loadJsPdf() {
  return new Promise((resolve, reject) => {
    if (window.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";
    script.onload = () => window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error("PDF library failed to load."));
    script.onerror = () => reject(new Error("Could not load the PDF library. Check your internet connection."));
    document.head.appendChild(script);
  });
}

function pdfSafe(value) {
  return String(value ?? "").trim() || "Not provided";
}

async function makeRegistrationPdf(row, type) {
  try {
    const JsPDF = await loadJsPdf();
    const doc = new JsPDF({ unit: "mm", format: "a4" });
    const margin = 18;
    let y = 18;

    doc.setFillColor(6, 27, 70);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("ALL STARS FOOTBALL CLUB", margin, 13);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(type === "player" ? "PLAYER REGISTRATION FORM" : "MANAGEMENT REGISTRATION FORM", margin, 22);

    doc.setTextColor(7, 21, 47);
    y = 42;

    // Passport photo from the private Supabase bucket.
    try {
      if (row.passport_path) {
        const { data, error } = await sb.storage
          .from("player-documents")
          .createSignedUrl(row.passport_path, 300);
        if (!error && data?.signedUrl) {
          const img = await fetch(data.signedUrl).then(r => r.blob());
          const dataUrl = await blobToDataUrl(img);
          doc.addImage(dataUrl, "JPEG", 155, 37, 35, 40);
        }
      }
    } catch (_) {
      // PDF remains usable even if the photo cannot be loaded.
    }

    const fields = type === "player"
      ? [
          ["Registration ID", row.registration_code],
          ["Status", row.status],
          ["Full name", row.full_name],
          ["Date of birth", row.date_of_birth],
          ["Gender", row.gender],
          ["Player category", row.player_category],
          ["Phone", row.phone],
          ["WhatsApp", row.whatsapp],
          ["Email", row.email],
          ["State", row.state],
          ["LGA", row.lga],
          ["Address", row.address],
          ["Position", row.position],
          ["Preferred foot", row.preferred_foot],
          ["Height", row.height],
          ["Previous club", row.previous_club],
          ["Playing experience", row.playing_experience],
          ["Parent/Guardian", row.parent_guardian_name],
          ["Parent/Guardian phone", row.parent_guardian_phone],
          ["Emergency contact", row.emergency_name],
          ["Emergency phone", row.emergency_phone],
          ["Medical/emergency information", row.medical_information],
          ["Submitted", row.created_at ? new Date(row.created_at).toLocaleString() : ""]
        ]
      : [
          ["Registration ID", row.registration_code],
          ["Status", row.status],
          ["Full name", row.full_name],
          ["Role / position", row.role],
          ["Date of birth", row.date_of_birth],
          ["Gender", row.gender],
          ["Phone", row.phone],
          ["WhatsApp", row.whatsapp],
          ["Email", row.email],
          ["Address", row.address],
          ["Experience", row.experience],
          ["Qualifications", row.qualifications],
          ["Emergency contact", row.emergency_name],
          ["Emergency phone", row.emergency_phone],
          ["Other information", row.other_information],
          ["Submitted", row.created_at ? new Date(row.created_at).toLocaleString() : ""]
        ];

    for (const [label, value] of fields) {
      const text = pdfSafe(value);
      const lines = doc.splitTextToSize(text, 125);
      if (y + Math.max(8, lines.length * 5) > 275) {
        doc.addPage();
        y = 18;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`${label}:`, margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(lines, margin + 43, y);
      y += Math.max(7, lines.length * 5);
    }

    if (type === "player") {
      y += 5;
      doc.setDrawColor(180, 190, 205);
      doc.line(margin, y, 192, y);
      y += 8;
      doc.setFont("helvetica", "bold");
      doc.text("Consent", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(row.consent ? "Confirmed" : "Not confirmed", margin + 43, y);
    }

    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 125);
      doc.text(`All Stars Football Club • Page ${p} of ${pages}`, margin, 290);
    }

    doc.save(`${type === "player" ? "Player" : "Management"}-${row.registration_code}.pdf`);
  } catch (err) {
    alert(err.message || "Could not create PDF.");
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

sb.auth.getSession().then(({ data: { session } }) => {
  if (session) loadDashboard("players");
});
