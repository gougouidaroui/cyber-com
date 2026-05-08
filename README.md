# CyberCom — Plateforme de messagerie sécurisée

Application de messagerie chiffrée utilisant **Merkle-Hellman** et **ElGamal** avec visualisation pédagogique et module d'attaque sur Merkle-Hellman.

## Fonctionnalités

- Génération de clés Merkle-Hellman et ElGamal
- Chiffrement et déchiffrement de messages
- Visualisation pédagogique des étapes cryptographiques
- Module d'attaque LLL sur Merkle-Hellman
- Comparaison sécurité / performance des deux algorithmes

## Stack

- **Frontend:** React 19 + Vite (ESM)
- **Backend:** Node.js + Express (CommonJS)
- **DB:** SQLite (auto-initialisée)
- **Crypto:** implémentation from scratch en JS

## Démarrage rapide

```sh
# Terminal 1 — Backend (port 3000)
cd backend && node server.js

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

## Structure

```
backend/      API Express + SQLite + crypto from scratch
frontend/    SPA React 19
crack.js     Script d'attaque LLL autonome (lit directement la DB)
```

## Commandes

```sh
# Backend
cd backend && node server.js

# Frontend
cd frontend && npm run dev      # dev
cd frontend && npm run build    # prod
cd frontend && npm run lint     # ESLint
```

## API

- `POST /api/auth/register` — Inscription
- `POST /api/auth/login` — Connexion (JWT)
- `GET/POST /api/keys` — Génération de clés
- `GET/POST /api/messages` — Envoyer/recevoir messages chiffrés
- `POST /api/attack` — Lancer l'attaque sur un message

## Attack

Le script `crack.js` à la racine est un outil autonome d'attaque LLL sur Merkle-Hellman. Il lit directement `backend/database.sqlite` et récupère le plaintext des messages chiffrés.

```sh
node crack.js
```
