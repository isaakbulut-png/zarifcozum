const assert = require('node:assert/strict');
const test = require('node:test');
const {isParentPanelDemoEnabled} = require('../lib/parent-panel-demo');

test('parent panel demo requires explicit opt-in and is disabled in production', () => {
  assert.equal(isParentPanelDemoEnabled({NODE_ENV: 'development'}), false);
  assert.equal(isParentPanelDemoEnabled({NODE_ENV: 'development', LOCAL_PARENT_PANEL_DEMO: 'true'}), true);
  assert.equal(isParentPanelDemoEnabled({NODE_ENV: 'production', LOCAL_PARENT_PANEL_DEMO: 'true'}), false);
});
