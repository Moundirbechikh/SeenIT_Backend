const Suggestion = require('../models/Suggestion');
const UserFilm   = require('../models/UserFilm');
const User       = require('../models/User');

const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

// ── HELPER : clé de semaine (Le pivot est le Dimanche) ────────
// Chaque dimanche, cette fonction génère une nouvelle clé unique (ex: "2026-06-28")
function getWeekKey(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0=dim, 1=lun, ...
  d.setDate(d.getDate() - day); // recule au dimanche
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

// ── GET /api/suggestions/week — Toutes les suggestions de la semaine courante ─
exports.getWeeklySuggestions = async (req, res) => {
  try {
    const weekKey = getWeekKey();

    const suggestions = await Suggestion.find({ weekKey })
      .populate('userId', 'username email')
      .lean();

    const formatted = suggestions.map(s => ({
      _id:      s._id,
      weekKey:  s.weekKey,
      user: {
        _id:      s.userId._id,
        username: s.userId.username || s.userId.email?.split('@')[0] || 'Cinéphile',
        email:    s.userId.email,
      },
      films: s.films.map(f => ({
        ...f,
        posterUrl: f.posterPath ? `${TMDB_IMG}${f.posterPath}` : '',
      })),
      isOwn: s.userId._id.toString() === req.userId,
    }));

    res.json({ suggestions: formatted, weekKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── GET /api/suggestions/my — Ma sélection de la semaine ─────────────────────
exports.getMySuggestion = async (req, res) => {
  try {
    const weekKey = getWeekKey();
    const suggestion = await Suggestion.findOne({ userId: req.userId, weekKey }).lean();

    if (!suggestion) {
      // S'il n'a pas encore de suggestion cette semaine, il peut en ajouter 3
      return res.json({ suggestion: null, weekKey, canAdd: true, remaining: 3 });
    }

    const remaining = 3 - suggestion.films.length;
    res.json({
      suggestion: {
        ...suggestion,
        films: suggestion.films.map(f => ({
          ...f,
          posterUrl: f.posterPath ? `${TMDB_IMG}${f.posterPath}` : '',
        })),
      },
      weekKey,
      canAdd: remaining > 0, // Plus de contrainte de jour, juste le nombre restant
      remaining,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── POST /api/suggestions/add — Ajouter un film à ma sélection ───────────────
exports.addToSuggestion = async (req, res) => {
  try {
    const { userFilmId } = req.body;

    if (!userFilmId)
      return res.status(400).json({ message: 'userFilmId est requis' });

    // Récupère le film de l'utilisateur
    const userFilm = await UserFilm.findOne({ _id: userFilmId, userId: req.userId })
      .populate('filmId');

    if (!userFilm)
      return res.status(404).json({ message: 'Film introuvable dans tes archives' });

    const weekKey = getWeekKey();

    // Récupère ou crée la suggestion de la semaine
    let suggestion = await Suggestion.findOne({ userId: req.userId, weekKey });

    if (!suggestion) {
      suggestion = new Suggestion({ userId: req.userId, weekKey, films: [] });
    }

    // Vérifie la limite de 3 films
    if (suggestion.films.length >= 3) {
      return res.status(400).json({ message: 'Tu as déjà ajouté 3 films cette semaine.' });
    }

    // Vérifie si le film est déjà dans la sélection
    const alreadyIn = suggestion.films.some(f => f.tmdbId === userFilm.tmdbId);
    if (alreadyIn) {
      return res.status(409).json({ message: 'Ce film est déjà dans ta sélection de la semaine.' });
    }

    // Ajoute le film
    suggestion.films.push({
      userFilmId: userFilm._id,
      tmdbId:     userFilm.tmdbId,
      title:      userFilm.filmId.title,
      year:       userFilm.filmId.year,
      posterPath: userFilm.filmId.posterPath,
      rating:     userFilm.rating,
      section:    userFilm.section,
    });

    await suggestion.save();

    res.status(201).json({
      suggestion: {
        ...suggestion.toObject(),
        films: suggestion.films.map(f => ({
          ...f.toObject(),
          posterUrl: f.posterPath ? `${TMDB_IMG}${f.posterPath}` : '',
        })),
      },
      remaining: 3 - suggestion.films.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── DELETE /api/suggestions/remove/:filmIndex — Retirer un film ───────────────
exports.removeFromSuggestion = async (req, res) => {
  try {
    const weekKey = getWeekKey();
    const { tmdbId } = req.params;

    const suggestion = await Suggestion.findOne({ userId: req.userId, weekKey });
    if (!suggestion)
      return res.status(404).json({ message: 'Aucune sélection cette semaine' });

    suggestion.films = suggestion.films.filter(f => f.tmdbId !== parseInt(tmdbId));
    await suggestion.save();

    res.json({ success: true, remaining: 3 - suggestion.films.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

exports.getWeekKey = getWeekKey;