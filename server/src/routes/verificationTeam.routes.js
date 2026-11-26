const express = require('express');
const router = express.Router();
const verificationTeamController = require('../controllers/verificationTeamController');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');

// Verification Teams routes are strictly protected by manage_verification_teams capability
router.use(requireAuth);
router.use(requirePermission('manage_verification_teams'));

router.get('/locations', verificationTeamController.getLocations);
router.get('/', verificationTeamController.getTeams);
router.post('/', verificationTeamController.saveTeam);
router.delete('/:unitId', verificationTeamController.deleteTeam);

module.exports = router;
