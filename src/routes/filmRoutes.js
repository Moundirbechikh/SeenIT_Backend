const express  = require('express');
const router   = express.Router();
const film     = require('../controllers/filmController');
const protect  = require('../middleware/authMiddleware');

router.use(protect);

router.get('/search',         film.searchTMDB); // <-- La nouvelle route
router.post('/add',           film.addFilm);
router.get('/my',             film.getMyFilms);
router.get('/stats',          film.getStats);
router.put('/:id/toggle',     film.toggleFlag);
router.delete('/:id',         film.deleteFilm);

module.exports = router;