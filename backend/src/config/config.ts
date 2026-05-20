export default () => ({
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  database: {
    connectionString: process.env.MONGO_URL,
  },
  mail: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  frontendUrl: process.env.FRONTEND_URL,
  seed: {
    adminName: process.env.SEED_ADMIN_NAME,
    adminEmail: process.env.SEED_ADMIN_EMAIL,
    adminPassword: process.env.SEED_ADMIN_PASSWORD,
    superAdminName: process.env.SEED_SUPER_ADMIN_NAME,
    superAdminEmail: process.env.SEED_SUPER_ADMIN_EMAIL,
    superAdminPassword: process.env.SEED_SUPER_ADMIN_PASSWORD,
  },
});