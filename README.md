## Créer une nouvelle issue

- title: Mon issue de secours
- labels: 
  - Type:Feature (le type d'issue)
  - State:ToPlan (on choisit le label de départ, il n'est pas set automatiquement)
  - Expert:API (domaine d'expertise)
- milestone: v1.0.0
- project: github-issue-workflow

Une fois créée, envoyer cette issue dans la colonne ToPlan du project.

## Workflows

- déplacer vers la colonne ToDo: changement du label State:ToPlan pour State:ToDo
- déplacer vers la colonne InProgress: 
  - changement du label State:ToPlan pour State:ToDo
  - création d'une branche depuis la branche correspondante à la milestone
  - nouvelle entrée dans le fichier changelog.json
  - création d'une pull request entre la nouvelle branche et la branche de release
- déplacer dans le colonne InReview: 
  - changement du label State:xxx
