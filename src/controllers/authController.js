const User    = require('../models/User');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET || 'seenit_secret_key';
const JWT_EXPIRES = '7d';

// ── REGISTER ──────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email et mot de passe requis' });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(409).json({ message: 'Cet email est déjà utilisé' });

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password: hash, name });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, name: user.name, theme: user.theme }
    });
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
    if (!user)
      return res.status(401).json({ message: 'Identifiants incorrects' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: 'Identifiants incorrects' });

    // Mise à jour du lastSeen à chaque connexion
    user.lastSeen = new Date();
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name, theme: user.theme }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
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
      user: { id: user._id, email: user.email, name: user.name, theme: user.theme }
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