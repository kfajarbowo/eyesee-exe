
const { initializeDatabase } = require('./schema');
const { generatedKeysRepo, licenseRepo, adminUsersRepo } = require('./db-sqlite');

initializeDatabase();

module.exports = {
    generatedKeysRepo,
    licenseRepo,
    adminUsersRepo
};
