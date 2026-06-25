const Film     = require('../models/Film');
const UserFilm = require('../models/UserFilm');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE    = 'https://api.themoviedb.org/3';

// ── HELPER : récupère les credits (acteurs + réalisateur) depuis TMDB ─────────
async function fetchCredits(tmdbId) {
  try {
    const res  = await fetch(`${TMDB_BASE}/movie/${tmdbId}/credits?api_key=${TMDB_API_KEY}&language=fr-FR`);
    const data = await res.json();
    const actors = (data.cast || []).slice(0, 6).map(a => ({
      name:        a.name,
      character:   a.character,
      profilePath: a.profile_path || '',
    }));
    const directorEntry = (data.crew || []).find(c => c.job === 'Director');
    const director = directorEntry ? directorEntry.name : '';
    return { actors, director };
  } catch {
    return { actors: [], director: '' };
  }
}

// ── HELPER : récupère ou crée un Film dans la BDD ────────────────────────────
async function getOrCreateFilm(tmdbData) {
  // 1. Cherche si le film existe déjà en BDD
  let film = await Film.findOne({ tmdbId: tmdbData.id });
  if (film) return film;

  // 2. Film inconnu → on récupère les credits et on le crée
  const { actors, director } = await fetchCredits(tmdbData.id);

  film = await Film.create({
    tmdbId:      tmdbData.id,
    title:       tmdbData.title,
    year:        tmdbData.release_date?.slice(0, 4) || '?',
    overview:    tmdbData.overview || '',
    posterPath:  tmdbData.poster_path || '',
    genres:      (tmdbData.genres || tmdbData.genre_ids?.map(id => ({ id, name: '' })) || []),
    voteAverage: tmdbData.vote_average || 0,
    actors,
    director,
  });

  return film;
}

// ── POST /api/films/add ───────────────────────────────────────────────────────
// Body : { tmdbData, rating, section, comment, isFavorite, isHeart }
exports.addFilm = async (req, res) => {
  try {
    const { tmdbData, rating, section, comment, isFavorite, isHeart } = req.body;

    if (!tmdbData || !rating || !section)
      return res.status(400).json({ message: 'tmdbData, rating et section sont requis' });

    // Récupère ou crée le film dans la collection partagée
    const film = await getOrCreateFilm(tmdbData);

    // Vérifie si l'user a déjà ce film
    const exists = await UserFilm.findOne({ userId: req.userId, tmdbId: tmdbData.id });
    if (exists)
      return res.status(409).json({ message: 'Tu as déjà archivé ce film' });

    // Crée l'entrée personnelle
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
    });

    res.status(201).json({ userFilm, film });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── CONSTANTES ───────────────────────────────────────────────────────────────
const TMDB_GENRES = {
    28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie",
    80: "Crime", 99: "Documentaire", 18: "Drame", 10751: "Familial",
    14: "Fantastique", 36: "Histoire", 27: "Horreur", 10402: "Musique",
    9648: "Mystère", 10749: "Romance", 878: "Sci-Fi",
    10770: "Téléfilm", 53: "Thriller", 10752: "Guerre", 37: "Western"
  };
  
  // ── GET /api/films/search ─────────────────────────────────────────────────────
  // Proxy pour chercher sur TMDB depuis le backend et formater les résultats
  exports.searchTMDB = async (req, res) => {
    try {
      const { query } = req.query;
      if (!query) return res.json({ results: [] });
  
      // 1. Recherche basique
      const resTMDB = await fetch(`${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR&page=1`);
      const data = await resTMDB.json();
      const topResults = (data.results || []).slice(0, 6);
  
      // 2. Enrichir avec les acteurs et formater proprement pour le frontend
      const enrichedResults = await Promise.all(topResults.map(async (film) => {
        const { actors } = await fetchCredits(film.id);
        
        // Traduire les ID de genres en noms lisibles
        const genreNames = (film.genre_ids || [])
          .map(id => TMDB_GENRES[id])
          .filter(Boolean);
  
        return {
          id: film.id,
          title: film.title,
          year: film.release_date ? film.release_date.slice(0, 4) : '—',
          poster_path: film.poster_path,
          vote_average: film.vote_average,
          genres: genreNames, 
          actors: actors.slice(0, 2), // Exactement 2 acteurs pour la preview
        };
      }));
  
      res.json({ results: enrichedResults });
    } catch (err) {
      console.error("Erreur Search TMDB:", err);
      res.status(500).json({ message: 'Erreur lors de la recherche' });
    }
  };
  
  // ── HELPER MODIFIÉ : Récupère les données PARFAITES pour la BDD ──────────────
  async function getOrCreateFilm(tmdbData) {
    let film = await Film.findOne({ tmdbId: tmdbData.id });
    if (film) return film;
  
    // Au lieu de se fier aux données partielles de la recherche, 
    // on demande à TMDB la fiche COMPLÈTE du film. (Ça règle ton bug de genres !)
    const resDetails = await fetch(`${TMDB_BASE}/movie/${tmdbData.id}?api_key=${TMDB_API_KEY}&language=fr-FR`);
    const fullTmdbData = await resDetails.json();
  
    const { actors, director } = await fetchCredits(tmdbData.id);
  
    film = await Film.create({
      tmdbId:      fullTmdbData.id,
      title:       fullTmdbData.title,
      year:        fullTmdbData.release_date?.slice(0, 4) || '?',
      overview:    fullTmdbData.overview || '',
      posterPath:  fullTmdbData.poster_path || '',
      genres:      fullTmdbData.genres || [], // TMDB renvoie ici un vrai tableau d'objets {id, name}
      voteAverage: fullTmdbData.vote_average || 0,
      actors,
      director,
    });
  
    return film;
  }
// ── GET /api/films/my ─────────────────────────────────────────────────────────
// Retourne tous les films de l'user avec les données TMDB mergées
exports.getMyFilms = async (req, res) => {
  try {
    const userFilms = await UserFilm.find({ userId: req.userId })
      .populate('filmId')
      .sort({ watchedAt: -1 });

    // Merge données Film + données UserFilm en un objet plat
    const films = userFilms.map(uf => ({
      _id:        uf._id,
      tmdbId:     uf.tmdbId,
      // Données TMDB
      title:      uf.filmId.title,
      year:       uf.filmId.year,
      overview:   uf.filmId.overview,
      posterPath: uf.filmId.posterPath,
      genres:     uf.filmId.genres,
      actors:     uf.filmId.actors,
      director:   uf.filmId.director,
      voteAverage: uf.filmId.voteAverage,
      // Données user
      rating:     uf.rating,
      section:    uf.section,
      comment:    uf.comment,
      isFavorite: uf.isFavorite,
      isHeart:    uf.isHeart,
      journal:    uf.journal,
      watchedAt:  uf.watchedAt,
    }));

    res.json({ films });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── PUT /api/films/:id/toggle ─────────────────────────────────────────────────
// Body : { field: 'isFavorite' | 'isHeart' }
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
// Stats pour le dashboard
exports.getStats = async (req, res) => {
  try {
    const userFilms = await UserFilm.find({ userId: req.userId }).populate('filmId');

    const total      = userFilms.length;
    const eliteCount = userFilms.filter(f => f.section === 'elite').length;
    const heartCount = userFilms.filter(f => f.isHeart).length;
    const favCount   = userFilms.filter(f => f.isFavorite).length;
    const avgRating  = total > 0
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
    const favoriteGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    // Dernier film
    const lastFilm = userFilms[0] ? {
      title:      userFilms[0].filmId.title,
      year:       userFilms[0].filmId.year,
      posterPath: userFilms[0].filmId.posterPath,
      rating:     userFilms[0].rating,
      section:    userFilms[0].section,
      comment:    userFilms[0].comment,
      watchedAt:  userFilms[0].watchedAt,
    } : null;

    // Films coups de cœur
    const heartFilms = userFilms.filter(f => f.isHeart).slice(0, 3).map(uf => ({
      title:      uf.filmId.title,
      year:       uf.filmId.year,
      posterPath: uf.filmId.posterPath,
      rating:     uf.rating,
      section:    uf.section,
      comment:    uf.comment,
    }));

    res.json({ total, eliteCount, heartCount, favCount, avgRating, favoriteGenre, lastFilm, heartFilms });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};