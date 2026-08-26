// Durcissement securite transversal — Phase 11 (section 13 du cahier des
// charges : "HTTPS ; ... rate limiting ; protection contre brute force ;
// ...").
//
// Ce fichier regroupe ce qui s'applique a TOUTE l'API (en-tetes, limites de
// debit generales). Le rate limit specifique a l'authentification reste
// dans authRateLimit.ts (regles differentes : cle par IP uniquement, seuil
// plus bas, deja en place depuis la Phase 3).
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

// API JSON pure, jamais de HTML servi par ce serveur (le frontend est une
// origine separee, voir env.corsOrigin) : la CSP par defaut de helmet n'a
// rien a proteger ici et ne ferait que compliquer un futur changement sans
// benefice reel. On garde en revanche tous les autres en-tetes (HSTS,
// X-Content-Type-Options, X-Frame-Options, etc.).
//
// crossOriginResourcePolicy : la valeur par defaut de helmet ('same-origin')
// bloquerait le frontend (origine differente, voir CORS_ORIGIN) lorsqu'il
// charge un message vocal via <audio src=".../audio" crossOrigin="use-
// credentials">. On l'assouplit explicitement a 'cross-origin' : la route
// verifie deja elle-meme que le demandeur est bien expediteur/destinataire
// (voir voice-messages.controller.ts), donc ce n'est pas une regression de
// confidentialite.
export const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
})

// Limite generale, large : sert surtout a empecher un client (ou un bug
// frontend en boucle) de marteler l'API sans borne, pas a bloquer un usage
// normal. Les endpoints sensibles (auth, recherche, envoi de vocal) ont en
// plus leur propre limite, plus stricte — voir plus bas et authRateLimit.ts.
export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Trop de requetes. Reessayez dans un instant.' },
})

// Fabrique un limiteur plus strict pour un endpoint particulier (recherche
// d'utilisateurs, envoi de message vocal...) : ces actions sont plus
// couteuses (requete DB, ecriture disque) et plus interessantes a
// bombarder pour un script abusif qu'un simple GET.
export function strictRateLimit(limit: number, windowMs = 60_000) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 'RATE_LIMITED', message: 'Trop de requetes. Reessayez dans un instant.' },
  })
}
