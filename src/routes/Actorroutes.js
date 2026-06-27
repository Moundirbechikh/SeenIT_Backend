const express  = require('express');
const router   = express.Router();
const protect  = require('../middleware/authMiddleware');
const actor    = require('../controllers/Actorcontroller');

// Toutes les routes sont protégées
router.put('/rate',  protect, actor.rateActor);
router.get('/my',   protect, actor.getMyActorRatings);
router.get('/gold', protect, actor.getGoldActors);

module.exports = router;

// ── À ajouter dans server.js ─────────────────────────────────────────────────
// const actorRoutes = require('./routes/actorRoutes');
// app.use('/api/actors', actorRoutes);