import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 10000);
const maxUploadMB = Number(process.env.MAX_UPLOAD_MB || 5);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: maxUploadMB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  }
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function required(body, fields) {
  return fields.filter((f) => !clean(body[f]));
}

app.post("/api/register/player", upload.single("passport"), async (req, res) => {
  try {
    const body = req.body || {};
    const missing = required(body, [
      "full_name", "date_of_birth", "phone", "address",
      "position", "player_category", "emergency_name", "emergency_phone"
    ]);

    if (missing.length) {
      return res.status(400).json({ error: `Please complete: ${missing.join(", ")}` });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Please upload a passport photograph." });
    }

    const categories = ["Senior", "Junior / U16"];
    if (!categories.includes(clean(body.player_category))) {
      return res.status(400).json({ error: "Invalid player category." });
    }

    const ext = (req.file.mimetype.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const safeName = clean(body.full_name).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const filePath = `players/${Date.now()}-${safeName}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("player-documents")
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const payload = {
      full_name: clean(body.full_name),
      passport_path: filePath,
      date_of_birth: clean(body.date_of_birth),
      gender: clean(body.gender),
      phone: clean(body.phone),
      whatsapp: clean(body.whatsapp),
      email: clean(body.email),
      address: clean(body.address),
      state: clean(body.state),
      lga: clean(body.lga),
      position: clean(body.position),
      preferred_foot: clean(body.preferred_foot),
      height: clean(body.height),
      playing_experience: clean(body.playing_experience),
      previous_club: clean(body.previous_club),
      player_category: clean(body.player_category),
      parent_guardian_name: clean(body.parent_guardian_name),
      parent_guardian_phone: clean(body.parent_guardian_phone),
      emergency_name: clean(body.emergency_name),
      emergency_phone: clean(body.emergency_phone),
      medical_information: clean(body.medical_information),
      consent: body.consent === "on",
      status: "Pending"
    };

    if (payload.player_category === "Junior / U16" &&
        (!payload.parent_guardian_name || !payload.parent_guardian_phone)) {
      return res.status(400).json({ error: "Parent/Guardian name and phone are required for Junior / U16 players." });
    }

   const { data, error } = await supabaseAdmin
  .from("player_registrations")
  .insert(payload)
  .select("registration_id, registration_code")
  .single();

    
    if (error) {
      await supabaseAdmin.storage.from("player-documents").remove([filePath]);
      throw error;
    }

    res.json({
      ok: true,
      registration_id: data.registration_id,
      registration_code: data.registration_code
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration could not be submitted. Please try again." });
  }
});

app.post("/api/register/management", upload.single("passport"), async (req, res) => {
  try {
    const body = req.body || {};
    const missing = required(body, ["full_name", "role", "phone", "address"]);
    if (missing.length) {
      return res.status(400).json({ error: `Please complete: ${missing.join(", ")}` });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Please upload a passport photograph." });
    }

    const ext = (req.file.mimetype.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const safeName = clean(body.full_name).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const filePath = `management/${Date.now()}-${safeName}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("player-documents")
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });
    if (uploadError) throw uploadError;

    const payload = {
      full_name: clean(body.full_name),
      passport_path: filePath,
      date_of_birth: clean(body.date_of_birth),
      gender: clean(body.gender),
      role: clean(body.role),
      phone: clean(body.phone),
      whatsapp: clean(body.whatsapp),
      email: clean(body.email),
      address: clean(body.address),
      experience: clean(body.experience),
      qualifications: clean(body.qualifications),
      emergency_name: clean(body.emergency_name),
      emergency_phone: clean(body.emergency_phone),
      other_information: clean(body.other_information),
      status: "Pending"
    };

    /***const { data, error } = await supabaseAdmin
      .from("management_registrations")
      .insert(payload)
      .select("registration_id, registration_code")
      .single(); *****/
    
const { error } = await supabaseAdmin
  .from("management_registrations")
  .insert(payload);
    
    if (error) {
      await supabaseAdmin.storage.from("player-documents").remove([filePath]);
      throw error;
    }

   /*** res.json({
      ok: true,
      registration_id: data.registration_id,
      registration_code: data.registration_code
    }); ***/

    res.json({
  ok: true,
  message: "Management registration submitted successfully."
});
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration could not be submitted. Please try again." });
  }
});

app.get("*splat", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => console.log(`All Stars registration server running on port ${port}`));
