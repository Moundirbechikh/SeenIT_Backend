const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library'); // 👈 Ajout pour Google

const JWT_SECRET = process.env.JWT_SECRET || 'seenit_secret_key';
const JWT_EXPIRES = '7d';

// Initialisation du client Google avec ta variable d'environnement
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── REGISTER CLASSIQUE ────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { email, password, username } = req.body; // Changé 'name' en 'username'

    if (!email || !password)
      return res.status(400).json({ message: 'Email et mot de passe requis' });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(409).json({ message: 'Cet email est déjà utilisé' });

    const hash = await bcrypt.hash(password, 12);
    // iconique sera 'false' par défaut grâce au modèle
    const user = await User.create({ email, password: hash, username });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, username: user.username, theme: user.theme, iconique: user.iconique }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── LOGIN CLASSIQUE ───────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    // On vérifie aussi s'il a un mot de passe (les comptes Google n'en ont pas forcément)
    if (!user || !user.password)
      return res.status(401).json({ message: 'Identifiants incorrects ou compte Google' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: 'Identifiants incorrects' });

    // Mise à jour du lastSeen à chaque connexion
    user.lastSeen = new Date();
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({
      token,
      user: { id: user._id, email: user.email, username: user.username, theme: user.theme, iconique: user.iconique }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── INSCRIPTION / CONNEXION GOOGLE (NOUVEAU) ──────────────────────────────────
exports.googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    // 1. On demande à Google si le token est valide
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    // 2. On récupère les infos certifiées par Google
    const { email, name, sub: googleId } = ticket.getPayload();

    // 3. On cherche si l'utilisateur existe déjà
    let user = await User.findOne({ email });

    if (!user) {
      // S'il n'existe pas, c'est une INSCRIPTION : on le crée
      user = await User.create({
        username: name,
        email: email,
        googleId: googleId,
        // Pas de mot de passe, et iconique est false par défaut !
      });
    } else {
      // S'il existe (CONNEXION), on met à jour son lastSeen et son googleId au cas où
      user.lastSeen = new Date();
      if (!user.googleId) user.googleId = googleId;
      await user.save();
    }

    // 4. On génère NOTRE token (comme pour un login classique)
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    
    // 5. On renvoie la même structure que les autres routes
    res.status(200).json({ 
      token, 
      user: { id: user._id, email: user.email, username: user.username, theme: user.theme, iconique: user.iconique } 
    });

  } catch (error) {
    console.error("Erreur Google Auth:", error);
    res.status(500).json({ message: "Erreur lors de l'authentification Google" });
  }
};

// ── VERIFY TOKEN (utilisé côté frontend au démarrage) ─────────────────────────
exports.verifyToken = async (req, res) => {
  try {
    // Le middleware auth aura déjà validé le token et mis req.userId
    const user = await User.findById(req.userId).select('-password');
    if (!user)
      return res.status(404).json({ message: 'Utilisateur introuvable' });

    // Vérification inactivité 7 jours
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(user.lastSeen).getTime() > sevenDays) {
      return res.status(401).json({ message: 'Session expirée par inactivité' });
    }

    // Met à jour lastSeen à chaque visite
    user.lastSeen = new Date();
    await user.save();

    res.json({
      user: { id: user._id, email: user.email, username: user.username, theme: user.theme, iconique: user.iconique }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── SAVE THEME ────────────────────────────────────────────────────────────────
exports.saveTheme = async (req, res) => {
  try {
    const { theme } = req.body;
    await User.findByIdAndUpdate(req.userId, { theme });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};