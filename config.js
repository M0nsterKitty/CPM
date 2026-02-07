const ADMIN_SECRET_PATH =
  process.env.ADMIN_SECRET_PATH || "cpm-7f4b1c2e9a3d6f0b";

// Change the admin URL suffix here (or via ADMIN_SECRET_PATH env) without exposing it to clients.
module.exports = {
  ADMIN_SECRET_PATH,
  ADMIN_COOKIE_NAME: "cpm_admin_session",
};
