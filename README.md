# CyberCom — Plateforme de messagerie sécurisée

Application de messagerie chiffrée utilisant **Merkle-Hellman** et **ElGamal** avec visualisation pédagogique et module d'attaque sur Merkle-Hellman.

## Fonctionnalités

- Génération de clés Merkle-Hellman et ElGamal
- Chiffrement et déchiffrement de messages
- Visualisation pédagogique des étapes cryptographiques
- Module d'attaque LLL sur Merkle-Hellman
- Comparaison sécurité / performance des deux algorithmes

## Stack

- **Frontend:** React 19.2 + Vite 8 + React Router 7
- **Backend:** Node.js + Express 5 + SQLite3
- **Auth:** JWT + bcrypt

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

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Inscription |
| `/api/auth/login` | POST | Connexion (JWT) |
| `/api/keys` | GET, POST | Générer/récupérer clés |
| `/api/messages` | GET, POST | Envoyer/recevoir messages |
| `/api/attack` | POST | Lancer attaque LLL |

## Attack

Le script `crack.js` à la racine est un outil autonome d'attaque LLL sur Merkle-Hellman. Il lit directement `backend/database.sqlite` et récupère le plaintext des messages chiffrés.

```sh
node crack.js
```

### Network Interceptor (network_crack.js)

Ce script utilise **TShark** (interface en ligne de commande de Wireshark) pour capturer le trafic réseau en temps réel et cracker les messages chiffrés à la volée.

**Fonctionnement:**
1. Lance TShark sur l'interface loopback pour capturer le trafic HTTP sur le port 3000
2. Extrait les clés publiques Merkle-Hellman lors des requêtes `/api/auth/login` et `/api/auth/register`
3. Intercepte les messages chiffrés et applique l'attaque LLL pour récupérer le plaintext

```sh
node network_crack.js
```

**Windows:** Si l'interface `lo` n'existe pas, utilisez la bonne interface réseau:

```cmd
:: Trouver le nom de l'interface loopback
tshark -D
```

Puis modifiez `-i 'lo'` dans le script (ligne 272) avec le nom de l'interface (ex: `-i 1` pour la première).
