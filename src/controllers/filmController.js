const Film     = require('../models/Film');
const UserFilm = require('../models/UserFilm');
const User     = require('../models/User'); // 🧠 Importé pour le check Iconic

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE    = 'https://api.themoviedb.org/3';

// ── MAP genre_ids TMDB → noms français (incluant Sci-Fi) ────────────────────
const TMDB_GENRES = {
  28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie',
  80: 'Crime', 99: 'Documentaire', 18: 'Drame', 10751: 'Familial',
  14: 'Fantastique', 36: 'Histoire', 27: 'Horreur', 10402: 'Musique',
  9648: 'Mystère', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'Téléfilm', 53: 'Thriller', 10752: 'Guerre', 37: 'Western',
};

// ── HELPER : vérifie si l'user doit débloquer Iconic ────────────────────────
const checkAndUnlockIconic = async (userId) => {
  try {
    // Compte tous les films archivés par cet utilisateur
    const count = await UserFilm.countDocuments({ userId });

    if (count >= 100) {
      // Débloque Iconic si ce n'est pas déjà fait
      await User.findByIdAndUpdate(
        userId,
        { $set: { iconique: true } },
        { new: false } // Pas besoin de récupérer le document modifié ici
      );
    }
  } catch (err) {
    console.error('checkAndUnlockIconic error:', err);
    // Non-bloquant : on ne fait pas planter la requête principale d'ajout de film
  }
};

// ── HELPER : credits TMDB ────────────────────────────────────────────────────
async function fetchCredits(tmdbId) {
  try {
    const res  = await fetch(
      `${TMDB_BASE}/movie/${tmdbId}/credits?api_key=${TMDB_API_KEY}&language=fr-FR`
    );
    const data = await res.json();
    const actors = (data.cast || []).slice(0, 6).map(a => ({
      name:        a.name,
      character:   a.character,
      profilePath: a.profile_path || '',
    }));
    const directorEntry = (data.crew || []).find(c => c.job === 'Director');
    return { actors, director: directorEntry ? directorEntry.name : '' };
  } catch {
    return { actors: [], director: '' };
  }
}

// ── HELPER : récupère ou crée un Film (avec données complètes TMDB) ──────────
async function getOrCreateFilm(tmdbData) {
  let film = await Film.findOne({ tmdbId: tmdbData.id });
  if (film) return film;

  // Fiche complète pour avoir les vrais genres {id, name}
  const resDetails = await fetch(
    `${TMDB_BASE}/movie/${tmdbData.id}?api_key=${TMDB_API_KEY}&language=fr-FR`
  );
  const full = await resDetails.json();

  const { actors, director } = await fetchCredits(tmdbData.id);

  // Normalise les genres : si pas de name, utilise le map
  const genres = (full.genres || []).map(g => ({
    id:   g.id,
    name: g.name === 'Science-Fiction' ? 'Sci-Fi' : (g.name || TMDB_GENRES[g.id] || 'Autre'),
  }));

  film = await Film.create({
    tmdbId:      full.id,
    title:       full.title,
    year:        full.release_date?.slice(0, 4) || '?',
    overview:    full.overview || '',
    posterPath:  full.poster_path || '',
    genres,
    voteAverage: full.vote_average || 0,
    actors,
    director,
  });

  return film;
}

// ── POST /api/films/add ───────────────────────────────────────────────────────
exports.addFilm = async (req, res) => {
  try {
    const { tmdbData, rating, section, comment, isFavorite, isHeart } = req.body;

    if (!tmdbData || !rating || !section)
      return res.status(400).json({ message: 'tmdbData, rating et section sont requis' });

    const film = await getOrCreateFilm(tmdbData);

    const exists = await UserFilm.findOne({ userId: req.userId, tmdbId: tmdbData.id });
    if (exists)
      return res.status(409).json({ message: 'Tu as déjà archivé ce film' });

    const userFilm = await UserFilm.create({
      userId:     req.userId,
      filmId:     film._id,
      tmdbId:     tmdbData.id,
      rating,
      section,
      comment:    comment || '',
      isFavorite: isFavorite || false,
      isHeart:    isHeart || false,
      journal:    comment ? [{ text: comment, date: new Date() }] : [],
      watchedAt:  new Date(), // date d'archivage = aujourd'hui
    });

    // 🏆 Déclenchement automatique de la vérification des 100 films
    await checkAndUnlockIconic(req.userId);

    // Récupération de l'état actuel de l'utilisateur pour informer le front en direct
    const updatedUser = await User.findById(req.userId).select('iconique');

    // Renvoie userFilm, film ET le flag iconique mis à jour (true/false)
    res.status(201).json({ 
      userFilm, 
      film, 
      iconique: updatedUser ? updatedUser.iconique : false 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── GET /api/films/search ─────────────────────────────────────────────────────
// Proxy TMDB : recherche + enrichment acteurs/genres
exports.searchTMDB = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json({ results: [] });

    const resTMDB = await fetch(
      `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR&page=1`
    );
    const data = await resTMDB.json();
    const top  = (data.results || []).slice(0, 6);

    const enriched = await Promise.all(top.map(async film => {
      const { actors } = await fetchCredits(film.id);
      const genres = (film.genre_ids || [])
        .map(id => TMDB_GENRES[id])
        .filter(Boolean);

      return {
        id:           film.id,
        title:        film.title,
        year:         film.release_date?.slice(0, 4) || '—',
        poster_path:  film.poster_path,
        vote_average: film.vote_average,
        genres,
        actors:       actors.slice(0, 2),
        overview:     film.overview || '',
      };
    }));

    res.json({ results: enriched });
  } catch (err) {
    console.error('Erreur Search TMDB:', err);
    res.status(500).json({ message: 'Erreur lors de la recherche' });
  }
};

// ── GET /api/films/my ─────────────────────────────────────────────────────────
exports.getMyFilms = async (req, res) => {
  try {
    // Tri par watchedAt desc (dernier vu en premier)
    const userFilms = await UserFilm.find({ userId: req.userId })
      .populate('filmId')
      .sort({ watchedAt: -1 });

    const films = userFilms.map(uf => ({
      _id:         uf._id,
      tmdbId:      uf.tmdbId,
      title:       uf.filmId.title,
      year:        uf.filmId.year,
      overview:    uf.filmId.overview,
      posterPath:  uf.filmId.posterPath,
      genres:      uf.filmId.genres,
      actors:      uf.filmId.actors,
      director:    uf.filmId.director,
      voteAverage: uf.filmId.voteAverage,
      rating:      uf.rating,
      section:     uf.section,
      comment:     uf.comment,
      isFavorite:  uf.isFavorite,
      isHeart:     uf.isHeart,
      journal:     uf.journal,
      watchedAt:   uf.watchedAt,
    }));

    res.json({ films });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── PUT /api/films/:id/toggle ─────────────────────────────────────────────────
exports.toggleFlag = async (req, res) => {
  try {
    const { field } = req.body;
    if (!['isFavorite', 'isHeart'].includes(field))
      return res.status(400).json({ message: 'field invalide' });

    const userFilm = await UserFilm.findOne({ _id: req.params.id, userId: req.userId });
    if (!userFilm)
      return res.status(404).json({ message: 'Film introuvable' });

    userFilm[field] = !userFilm[field];
    await userFilm.save();

    res.json({ [field]: userFilm[field] });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── DELETE /api/films/:id ─────────────────────────────────────────────────────
exports.deleteFilm = async (req, res) => {
  try {
    const userFilm = await UserFilm.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!userFilm)
      return res.status(404).json({ message: 'Film introuvable' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── GET /api/films/stats ──────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    // Tri watchedAt desc pour avoir le vrai dernier film vu
    const userFilms = await UserFilm.find({ userId: req.userId })
      .populate('filmId')
      .sort({ watchedAt: -1 });

    const total         = userFilms.length;
    const chefdoeuvreCount = userFilms.filter(f => f.section === 'chefdoeuvre').length;
    const eliteCount    = userFilms.filter(f => f.section === 'elite').length;
    const bienCount     = userFilms.filter(f => f.section === 'bien').length;
    const moyenCount    = userFilms.filter(f => f.section === 'moyen').length;
    const decuCount     = userFilms.filter(f => f.section === 'decu').length;
    const navetCount    = userFilms.filter(f => f.section === 'navet').length;
    const heartCount    = userFilms.filter(f => f.isHeart).length;
    const favCount      = userFilms.filter(f => f.isFavorite).length;
    const avgRating     = total > 0
      ? (userFilms.reduce((a, f) => a + f.rating, 0) / total).toFixed(1)
      : '0.0';

    // Genre dominant
    const genreCount = {};
    userFilms.forEach(uf => {
      (uf.filmId.genres || []).forEach(g => {
        const name = g.name || 'Autre';
        genreCount[name] = (genreCount[name] || 0) + 1;
      });
    });
    const favoriteGenre = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    // Dernier film vu (watchedAt le plus récent)
    const lastEntry = userFilms[0];
    const lastFilm  = lastEntry ? {
      title:      lastEntry.filmId.title,
      year:       lastEntry.filmId.year,
      posterPath: lastEntry.filmId.posterPath,
      rating:     lastEntry.rating,
      section:    lastEntry.section,
      comment:    lastEntry.comment,
      watchedAt:  lastEntry.watchedAt,
    } : null;

    // Films coups de cœur
    const heartFilms = userFilms
      .filter(f => f.isHeart)
      .slice(0, 5)
      .map(uf => ({
        title:      uf.filmId.title,
        year:       uf.filmId.year,
        posterPath: uf.filmId.posterPath,
        rating:     uf.rating,
        section:    uf.section,
        comment:    uf.comment,
        watchedAt:  uf.watchedAt,
      }));

    res.json({
      total, chefdoeuvreCount, eliteCount, bienCount,
      moyenCount, decuCount, navetCount,
      heartCount, favCount, avgRating,
      favoriteGenre, lastFilm, heartFilms,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};