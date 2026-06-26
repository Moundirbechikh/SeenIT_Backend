// ── HELPER : vérifie si l'user doit débloquer Iconic ────────────────────────
// À appeler après chaque ajout de film (addFilm, rateFilm, etc.)
const User     = require('../models/User');
const UserFilm = require('../models/UserFilm');

const checkAndUnlockIconic = async (userId) => {
  try {
    // Compte tous les films archivés par cet utilisateur
    const count = await UserFilm.countDocuments({ userId });

    if (count >= 100) {
      // Débloque Iconic si ce n'est pas déjà fait (évite une écriture inutile)
      await User.findByIdAndUpdate(
        userId,
        { $set: { iconique: true } },
        { new: false }   // on n'a pas besoin du document retourné
      );
    }
  } catch (err) {
    console.error('checkAndUnlockIconic error:', err);
    // Non-bloquant : on ne fail pas la requête principale si ça plante ici
  }
};

module.exports = { checkAndUnlockIconic };

// ════════════════════════════════════════════════════════════════════════════
// COMMENT L'INTÉGRER DANS filmController.js (ton fichier existant)
// ════════════════════════════════════════════════════════════════════════════
//
// Dans la fonction qui ajoute un film (ex: addFilm, rateFilm...) :
//
//   const { checkAndUnlockIconic } = require('./iconicHelper');   // ajuste le chemin
//
//   exports.addFilm = async (req, res) => {
//     try {
//       // ... ta logique existante de création du UserFilm ...
//       const newFilm = await UserFilm.create({ ... });
//
//       // 👇 Ajoute juste cette ligne après la création
//       await checkAndUnlockIconic(req.userId);
//
//       res.status(201).json(newFilm);
//     } catch (err) { ... }
//   };
//
// C'est tout. Si l'user vient d'atteindre 100 films, iconique passe à true en BDD.
// La prochaine fois que le frontend appelle /api/auth/verify (au démarrage),
// il récupérera iconique: true et débloquera le thème automatiquement.
//
// Si tu veux que ce soit instantané (sans attendre un refresh), tu peux aussi
// renvoyer l'info iconique dans la réponse addFilm :
//
//   const updatedUser = await User.findById(req.userId).select('iconique');
//   res.status(201).json({ film: newFilm, iconique: updatedUser.iconique });
//
// Et dans le frontend, mettre à jour user.iconique dans le state App.jsx.
// ════════════════════════════════════════════════════════════════════════════