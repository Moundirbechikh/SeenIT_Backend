const express    = require('express');
const router     = express.Router();
const auth       = require('../controllers/authController');
const protect    = require('../middleware/authMiddleware');

router.post('/register', auth.register);
router.post('/login',    auth.login);
router.get('/verify',    protect, auth.verifyToken);   // appelé au démarrage
router.put('/theme',     protect, auth.saveTheme);     // sauvegarde du thème

module.exports = router;