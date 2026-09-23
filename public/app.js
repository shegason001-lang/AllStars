// Replace these two values with the same Supabase project used by the server.
const SUPABASE_URL ="https://sagntfskpsyrwhzgtuzm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tfBwDmxzJr8kpWmU7IW3gg_pRJ0VJpi";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showMessage(el, text, error=false) {
  el.textContent = text;
  el.className = `message show${error ? " error" : ""}`;
}
 
/****async function submitForm(formId, endpoint, messageId, successText) {
  const form = document.getElementById(formId);
  const message = document.getElementById(messageId);
  ***/
async function submitForm(formId, endpoint, messageId, successText) {
  const form = document.getElementById(formId);
  if (!form) return;

  const message = document.getElementById(messageId);
  if (!form) return;
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

    const pageWidth = 210;
    const margin = 15;
    const navy = [8, 40, 95];
    const blue = [20, 105, 199];
    const lightBlue = [234, 242, 251];
    const text = [18, 33, 58];
    const muted = [100, 116, 139];
    const green = [17, 130, 59];
    const border = [216, 225, 236];

    let y = 15;

    // --------------------------------------------------
    // LOGO
    // --------------------------------------------------
    let logoData = null;

    try {
      const logoResponse = await fetch(
        `${window.location.origin}/all-stars-logo.jpeg`
      );

      if (logoResponse.ok) {
        const logoBlob = await logoResponse.blob();
        logoData = await blobToDataUrl(logoBlob);
      }
    } catch (_) {}

    // --------------------------------------------------
    // HEADER
    // --------------------------------------------------
    doc.setFillColor(...navy);
    doc.roundedRect(15, 10, 180, 27, 3, 3, "F");

    if (logoData) {
      try {
        doc.addImage(logoData, "JPEG", 19, 14, 19, 19);
      } catch (_) {}
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("ALL STARS FOOTBALL CLUB", 42, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(220, 235, 255);
    doc.text("Reach for the Stars", 42, 27);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.text("Shanu Village Minna, Niger State", 191, 19, { align: "right" });
    doc.text("+234 703 464 4779", 191, 25, { align: "right" });

    y = 45;

    // --------------------------------------------------
    // PASSPORT PHOTO
    // --------------------------------------------------
    let passportData = null;

    if (type === "player" && row.passport_path) {
      try {
        const { data, error } = await sb.storage
          .from("player-documents")
          .createSignedUrl(row.passport_path, 300);

        if (!error && data?.signedUrl) {
          const response = await fetch(data.signedUrl);

          if (response.ok) {
            const blob = await response.blob();
            passportData = await blobToDataUrl(blob);
          }
        }
      } catch (_) {}
    }

    // Passport box
    doc.setDrawColor(...border);
    doc.setFillColor(248, 250, 253);
    doc.roundedRect(157, y, 38, 43, 2, 2, "FD");

    if (passportData) {
      try {
        let imageType = "JPEG";

        if (passportData.startsWith("data:image/png")) {
          imageType = "PNG";
        } else if (passportData.startsWith("data:image/webp")) {
          imageType = "WEBP";
        }

        doc.addImage(
          passportData,
          imageType,
          159,
          y + 2,
          34,
          38
        );
      } catch (_) {
        doc.setTextColor(...muted);
        doc.setFontSize(7);
        doc.text("Passport photo", 176, y + 20, {
          align: "center"
        });
        doc.text("unavailable", 176, y + 25, {
          align: "center"
        });
      }
    } else {
      doc.setTextColor(...muted);
      doc.setFontSize(7);
      doc.text("Passport photo", 176, y + 20, {
        align: "center"
      });
      doc.text("not available", 176, y + 25, {
        align: "center"
      });
    }

    // --------------------------------------------------
    // TITLE
    // --------------------------------------------------
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);

    doc.text(
      type === "player"
        ? "PLAYER REGISTRATION"
        : "MANAGEMENT REGISTRATION",
      margin,
      y + 5
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(
      "APPLICATION CONFIRMATION",
      margin,
      y + 12
    );

    doc.setFontSize(7.5);
    doc.text(
      type === "player"
        ? "This document confirms that the player registration application has been received."
        : "This document confirms that the management registration application has been received.",
      margin,
      y + 19
    );

    y += 29;

    // --------------------------------------------------
    // REGISTRATION CODE + STATUS
    // --------------------------------------------------
    doc.setFillColor(...lightBlue);
    doc.setDrawColor(...border);
    doc.roundedRect(margin, y, 180, 22, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text("REGISTRATION CODE", 21, y + 7);

    doc.setFontSize(12);
    doc.setTextColor(...navy);
    doc.text(
      pdfSafe(row.registration_code),
      21,
      y + 15
    );

    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text("APPLICATION STATUS", 115, y + 7);

    const status =
      String(row.status || "Pending").toUpperCase();

    const statusColor =
      status === "APPROVED"
        ? green
        : status === "REJECTED"
        ? [180, 40, 40]
        : [180, 120, 20];

    doc.setTextColor(...statusColor);
    doc.setFontSize(10);
    doc.text(status, 115, y + 15);

    y += 29;

    // --------------------------------------------------
    // WATERMARK
    // --------------------------------------------------
    if (logoData) {
      try {
        doc.setGState(
          new doc.GState({ opacity: 0.045 })
        );

        doc.addImage(
          logoData,
          "JPEG",
          55,
          105,
          100,
          100
        );

        doc.setGState(
          new doc.GState({ opacity: 1 })
        );
      } catch (_) {}
    }

    // --------------------------------------------------
    // DETAILS
    // --------------------------------------------------
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    doc.text(
      type === "player"
        ? "PLAYER DETAILS"
        : "MANAGEMENT DETAILS",
      margin,
      y
    );

    y += 5;

    const fields =
      type === "player"
        ? [
            ["Full Name", row.full_name],
            ["Date of Birth", row.date_of_birth],
            ["Gender", row.gender],
            ["Player Category", row.player_category],
            ["Phone", row.phone],
            ["WhatsApp", row.whatsapp],
            ["Email", row.email],
            ["State", row.state],
            ["LGA", row.lga],
            ["Address", row.address],
            ["Position", row.position],
            ["Preferred Foot", row.preferred_foot],
            ["Height", row.height],
            ["Previous Club", row.previous_club],
            ["Playing Experience", row.playing_experience]
          ]
        : [
            ["Full Name", row.full_name],
            ["Role / Position", row.role],
            ["Date of Birth", row.date_of_birth],
            ["Gender", row.gender],
            ["Phone", row.phone],
            ["WhatsApp", row.whatsapp],
            ["Email", row.email],
            ["Address", row.address],
            ["Experience", row.experience],
            ["Qualifications", row.qualifications],
            ["Emergency Contact", row.emergency_name],
            ["Emergency Phone", row.emergency_phone],
            ["Other Information", row.other_information]
          ];

    // --------------------------------------------------
    // TWO-COLUMN DETAILS CARD
    // --------------------------------------------------
    const cardX = margin;
    const cardY = y;
    const cardW = 180;
    const leftX = 19;
    const rightX = 107;

    let leftY = y + 7;
    let rightY = y + 7;

    const splitAt = Math.ceil(fields.length / 2);

    const leftFields = fields.slice(0, splitAt);
    const rightFields = fields.slice(splitAt);

    const drawField = (field, x, currentY, width) => {
      const label = field[0];
      const value = pdfSafe(field[1]);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(...muted);
      doc.text(label.toUpperCase(), x, currentY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...text);

      const lines = doc.splitTextToSize(value, width);

      doc.text(lines, x, currentY + 5);

      return currentY + Math.max(10, lines.length * 4.2 + 6);
    };

    for (const field of leftFields) {
      leftY = drawField(field, leftX, leftY, 75);
    }

    for (const field of rightFields) {
      rightY = drawField(field, rightX, rightY, 75);
    }

    const bottomY = Math.max(leftY, rightY) + 2;

    doc.setDrawColor(...border);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(
      cardX,
      cardY,
      cardW,
      bottomY - cardY,
      2,
      2,
      "S"
    );

    y = bottomY + 6;

    // --------------------------------------------------
    // PARENT / GUARDIAN
    // --------------------------------------------------
    if (type === "player") {
      doc.setFillColor(...lightBlue);
      doc.setDrawColor(...border);
      doc.roundedRect(margin, y, 87, 30, 2, 2, "FD");

      doc.setTextColor(...navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("PARENT / GUARDIAN", 20, y + 7);

      doc.setTextColor(...text);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);

      doc.text(
        `Name: ${pdfSafe(row.parent_guardian_name)}`,
        20,
        y + 14
      );

      doc.text(
        `Phone: ${pdfSafe(row.parent_guardian_phone)}`,
        20,
        y + 20
      );

      doc.text(
        `Consent: ${row.consent ? "Confirmed" : "Not confirmed"}`,
        20,
        y + 26
      );

      // Emergency
      doc.setFillColor(248, 250, 253);
      doc.roundedRect(108, y, 87, 30, 2, 2, "FD");

      doc.setTextColor(...navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("EMERGENCY CONTACT", 113, y + 7);

      doc.setTextColor(...text);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);

      doc.text(
        `Name: ${pdfSafe(row.emergency_name)}`,
        113,
        y + 14
      );

      doc.text(
        `Phone: ${pdfSafe(row.emergency_phone)}`,
        113,
        y + 20
      );

      doc.text(
        `Medical: ${pdfSafe(row.medical_information)}`,
        113,
        y + 26
      );

      y += 37;
    }

    // --------------------------------------------------
    // NEXT STEPS
    // --------------------------------------------------
    doc.setFillColor(248, 250, 253);
    doc.setDrawColor(...border);
    doc.roundedRect(margin, y, 180, 31, 2, 2, "FD");

    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("NEXT STEPS", 20, y + 8);

    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3);

    const nextStepText =
      status === "APPROVED"
        ? "Keep this confirmation for your records. Present your registration code when requested by the club and follow the official training schedule and club instructions."
        : status === "REJECTED"
        ? "Please contact the All Stars Football Club management team if you need clarification regarding this application."
        : "Keep this confirmation for your records. Your application is awaiting review by the All Stars Football Club management team.";

    const nextLines = doc.splitTextToSize(
      nextStepText,
      165
    );

    doc.text(nextLines, 20, y + 15);

    y += 39;

    // --------------------------------------------------
    // AUTHORIZATION
    // --------------------------------------------------
    doc.setDrawColor(...navy);
    doc.line(15, y, 100, y);
    doc.line(110, y, 195, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...navy);
    doc.text("ALL STARS FOOTBALL CLUB", 15, y + 6);
    doc.text("AUTHORIZED RECORD", 110, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text("Management Team", 15, y + 11);
    doc.text("Registration confirmation", 110, y + 11);

    // --------------------------------------------------
    // FOOTER
    // --------------------------------------------------
    const pages = doc.getNumberOfPages();

    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);

      doc.setFillColor(...navy);
      doc.rect(0, 289, pageWidth, 8, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(255, 255, 255);

      doc.text(
        "ALL STARS FOOTBALL CLUB • Reach for the Stars",
        margin,
        294
      );

      doc.text(
        `Page ${p} of ${pages}`,
        195,
        294,
        { align: "right" }
      );
    }

    // --------------------------------------------------
    // SAVE
    // --------------------------------------------------
    doc.save(
      `${type === "player" ? "All-Stars-Player" : "All-Stars-Management"}-${row.registration_code}.pdf`
    );

  } catch (err) {
    console.error("PDF ERROR:", err);
    alert(
      err.message ||
      "Could not create the PDF. Please try again."
    );
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
