const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/authMiddleware');
const ctrl       = require('../controllers/Suggestioncontroller');

// Toutes les routes nécessitent une authentification
router.use(auth);

// GET  /api/suggestions/week  — toutes les suggestions de la semaine courante
router.get('/week', ctrl.getWeeklySuggestions);

// GET  /api/suggestions/my    — ma sélection de la semaine
router.get('/my', ctrl.getMySuggestion);

// POST /api/suggestions/add   — ajouter un film à ma sélection
router.post('/add', ctrl.addToSuggestion);

// DELETE /api/suggestions/remove/:tmdbId — retirer un film de ma sélection
router.delete('/remove/:tmdbId', ctrl.removeFromSuggestion);

module.exports = router;