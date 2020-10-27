---
name: Feature
about: Feature request
labels: 'Type:Feature'
assignees: 'Neime'

---

| Date | Referer | Origine |
|-|-|-|
| dd/mm/yyy | P.Nom | Produit ou Tech |

## Ressources additionnelles

- JIRA, Log

## Glossaire
- Terme 1 : définition
- Terme 2 : définition

## Description générale

Description de la feature, précisions d'ordre général, diagramme etc.

# Entités & Base de données

## NomEntité
### Propriétés 

|Nom|Type|Nullable|Valeur par défaut|Commentaire|
|---|---|---|---|---|
|foobar|string|false|"foo"|Nouvelle propriété, valeurs possibles : "foo", "bar."|

# Sécurité

Remarques **générales** concernant les autorisations, voteurs etc.

# Back Office

## UC1-BO

Routes, contrôleurs, templates, voters, providers...

## UC2-BO

...

# Middle Office

## UC1-MO

...

# Front Office

## UC1-FO

...

## UC3-FO

...

# API

## POST /administrator/object1/

### Description
Description de la route.

### Paramètres d'entrée 
[DTO/Input/Object](#input_object1)

### Réponse 
Réponse vide en cas de succès ou liste des erreurs.

## DTO/Input
### <a name="input_object1"></a> Object1
|Nom du paramètre|Type|Requis|Valeur par défaut|Commentaire|
|---|---|---|---|---|
|propriété|string|Oui||Description|

## DTO/Ouput
### <a name="ouput_object1"></a> Object1
|Propriété|Type|Description|
|---|---|---|
|propriété|array|lorem ipsum|