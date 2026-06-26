const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET = process.env.JWT_SECRET || 'seenit_secret_key';
const JWT_EXPIRES = '30d'; // 30 jours max, la règle des 7 jours d'inactivité est gérée côté verifyToken

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper : shape user renvoyée au frontend (toujours la même structure)
const userPayload = (user) => ({
  id:       user._id,
  email:    user.email,
  username: user.username,
  theme:    user.theme,
  iconique: user.iconique,   // boolean — le frontend s'en sert pour autoriser le thème Iconic
});

// ── REGISTER ─────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email et mot de passe requis' });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(409).json({ message: 'Cet email est déjà utilisé' });

    const hash  = await bcrypt.hash(password, 12);
    const user  = await User.create({ email, password: hash, username });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.status(201).json({ token, user: userPayload(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.password)
      return res.status(401).json({ message: 'Identifiants incorrects ou compte Google' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: 'Identifiants incorrects' });

    user.lastSeen = new Date();
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, user: userPayload(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── GOOGLE AUTH ───────────────────────────────────────────────────────────────
exports.googleAuth = async (req, res) => {
  try {
    const { credential, name: frontName } = req.body;

    if (!credential)
      return res.status(400).json({ message: "Jeton d'authentification manquant." });

    const tokenInfo = await client.getTokenInfo(credential);
    const email     = tokenInfo.email;
    const googleId  = tokenInfo.sub;
    const name      = frontName || 'Utilisateur SeenIt';

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ username: name, email, googleId });
    } else {
      user.lastSeen = new Date();
      if (!user.googleId) user.googleId = googleId;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.status(200).json({ token, user: userPayload(user) });
  } catch (error) {
    console.error('Erreur Google Auth:', error);
    res.status(500).json({ message: "Erreur lors de l'authentification Google" });
  }
};

// ── VERIFY TOKEN ──────────────────────────────────────────────────────────────
// Appelé au démarrage de l'app pour restaurer la session
exports.verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user)
      return res.status(404).json({ message: 'Utilisateur introuvable' });

    // Expiration par inactivité : 7 jours sans connexion → session morte
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(user.lastSeen).getTime() > SEVEN_DAYS) {
      return res.status(401).json({ message: 'Session expirée par inactivité' });
    }

    // Met à jour lastSeen à chaque vérification (maintient la session active)
    user.lastSeen = new Date();
    await user.save();

    res.json({ user: userPayload(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── SAVE THEME ────────────────────────────────────────────────────────────────
exports.saveTheme = async (req, res) => {
  try {
    const { theme } = req.body;

    // Sécurité : on ne laisse pas un non-iconique sauvegarder le thème iconic
    if (theme === 'iconic') {
      const user = await User.findById(req.userId);
      if (!user || !user.iconique) {
        return res.status(403).json({ message: 'Thème Iconic non débloqué' });
      }
    }

    await User.findByIdAndUpdate(req.userId, { theme });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};