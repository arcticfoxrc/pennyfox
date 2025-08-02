

npm install -g @google/clasp

clasp login

clasp create --title "Pennyfox App Script" --type standalone

clasp push

## record the deployment ID, use next deployment to avoid duplicate deployments
clasp deploy --description "pennyfox v1"

clasp deploy --deploymentId <DEPLOYMENT_ID_FROM_PREVIOUS_CMD> --description "pennyfox v2"

