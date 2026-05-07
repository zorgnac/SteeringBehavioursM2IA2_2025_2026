# Zorgnac

Cette branche ne s'intéresse qu'au chapitre 9, qui montre
des générations de voitures confrontées à des circuits 
hazardeux.

Une question se pose dans ce contexte, dès lors qu'on
identifie un peu trop sérieusement la chose à une situation réelle :
on ne veut certainement pas sacrifier des pilotes à chaque
course, en se disant que si quelques-uns survivent, ça le
fera bien. Non ! On cherche plutôt à trouver une voiture
fiable, qui résolve tous les circuits.

On veut ici savoir si la méthode générationnelle, telle
que présentée, a des chances d'arriver à un tel résultat.

Il y a deux axes de développement :
- il faut mettre en place un protocole qui permette
  de tester la résilience ; a minima, il s'agit de remettre
  en course les voitures qui ont réussi jusqu'à présent (les
  vieux)
  
- s'il s'avère qu'on arrive pas (en temps raisonable)
  à ateindre un prémisse de résilience, il faut
  se demander si c'est dû à la méthode, ou s'il
  faut remettre en cause les capteurs ou la topologie des
  cerveaux
  
Le code présenté ici propose un protocole tel que
décrit ci-dessus, implémente de nouveaux capteurs, et
autorise une configuration plus poussée des réseux de
neurones.
