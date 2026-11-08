function isParentPanelDemoEnabled(environment = process.env) {
  return environment.NODE_ENV !== 'production' &&
    environment.LOCAL_PARENT_PANEL_DEMO === 'true';
}

module.exports = {isParentPanelDemoEnabled};
