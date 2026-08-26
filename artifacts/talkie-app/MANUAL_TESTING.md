# Talkie Chat — recette manuelle Phase 19

## 1. Comptes et contacts
- [ ] Créer deux comptes de test.
- [ ] Ajouter le second utilisateur comme contact.
- [ ] Accepter la demande.
- [ ] Vérifier présence en ligne/hors ligne.

## 2. Messages texte
- [ ] Envoyer un texte.
- [ ] Vérifier réception instantanée.
- [ ] Recharger la page et vérifier l'historique.
- [ ] Vérifier ✓ envoyé, ✓✓ délivré et ✓✓ lu.
- [ ] Modifier un message.
- [ ] Vérifier « modifié » chez les deux utilisateurs.
- [ ] Supprimer pour tout le monde.

## 3. Indicateur et accueil
- [ ] Commencer à taper sur A et vérifier « A est en train d'écrire… » sur B.
- [ ] Vérifier disparition après arrêt de saisie.
- [ ] Vérifier aperçu du dernier message sur l'accueil.
- [ ] Vérifier badge non lu.
- [ ] Ouvrir la conversation et vérifier que le badge disparaît.

## 4. Vocaux
- [ ] Maintenir le bouton micro pour enregistrer.
- [ ] Annuler un enregistrement.
- [ ] Envoyer un vocal.
- [ ] Vérifier lecteur inline et durée.
- [ ] Vérifier réception lorsque le destinataire est hors ligne.

## 5. Photos
- [ ] Choisir une photo depuis la galerie.
- [ ] Prendre une photo avec la caméra.
- [ ] Vérifier aperçu avant envoi.
- [ ] Vérifier compression.
- [ ] Ouvrir la photo en plein écran.
- [ ] Vérifier qu'un autre utilisateur non autorisé ne peut pas récupérer le média.

## 6. Vidéos
- [ ] Choisir une vidéo.
- [ ] Vérifier aperçu avant envoi.
- [ ] Envoyer une vidéo valide.
- [ ] Lire la vidéo dans le fil.
- [ ] Tester une vidéo de plus de 5 minutes et vérifier son refus.
- [ ] Vérifier la limite de taille configurée côté serveur.

## 7. PWA et déploiement
- [ ] Tester installation sur Android/Chrome.
- [ ] Vérifier HTTPS.
- [ ] Vérifier Socket.IO en `wss://`.
- [ ] Vérifier notifications push.
- [ ] Redéployer le backend et vérifier que les médias stockés sur le volume persistent.
- [ ] Vérifier les migrations PostgreSQL.

## Important
La version finale ne contient plus le système PTT/WebRTC. Aucun test d'appel WebRTC, TURN ou STUN n'est donc requis.
