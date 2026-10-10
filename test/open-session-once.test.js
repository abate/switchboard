// see .ai/contexts/session-state.md ("Opening a session once")

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { setupSidebarDom } = require('./dom-setup');
const { loadAppFunctions } = require('./app-source');

const PROJECT = '/home/dev/proj';

function setup() {
  const ctx = setupSidebarDom();
  const { window } = ctx;
  const openTerminalCalls = [];
  const releases = [];
  Object.assign(window, {
    restoringWorkingSet: false,
    sessionOpenedOutsideRestore: false,
    skippedWorkingSetEntries: new Map(),
    restoreSavedIndex: new Map(),
    refreshSidebar: () => window.renderProjects(window.cachedProjects, true),
    createTerminalEntry: (session) => {
      const entry = { session, closed: false, terminal: { write() {}, focus() {} }, initialSize: {} };
      window.openSessions.set(session.sessionId, entry);
      return entry;
    },
    showSession: () => {},
    destroySession: (id) => { window.openSessions.delete(id); },
    guardResume: async () => true,
    resolveResumeSession: async (session) => session,
    resolveDefaultSessionOptions: async () => ({}),
    syncPtySizeAfterOpen: () => {},
    setSessionMcpState: () => {},
    setSessionSandboxed: () => {},
    forgetSessionExit: () => {},
    beginPtyOpen: () => {},
    settlePtyOpen: () => {},
    schedulePersistWorkingSet: () => {},
    pollActiveSessions: () => {},
  });
  Object.assign(window.api, {
    openTerminal: (sessionId) => {
      openTerminalCalls.push(sessionId);
      return new Promise((resolve) => releases.push(resolve));
    },
  });
  const project = {
    projectPath: PROJECT,
    sessions: [{ sessionId: 's1', name: 's1', modified: new Date().toISOString(), messageCount: 1 }],
  };
  window.cachedProjects = [project];
  window.cachedAllProjects = [project];
  window.sessionMap.set('s1', { sessionId: 's1', projectPath: PROJECT });
  loadAppFunctions(ctx.context, {
    declarations: ['continuationRetryCancelled', 'openingSessions'],
    functions: ['openSession', 'openSessionNow'],
  });
  window.renderProjects(window.cachedProjects, true);
  const row = () => window.document.getElementById('si-s1');
  const release = (result = { ok: true }) => releases.splice(0).forEach((r) => r(result));
  return { window, row, openSession: (...args) => window.openSession(...args), openTerminalCalls, release, destroy: () => ctx.destroy() };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('a double click on a session row opens its terminal once', async () => {
  const h = setup();
  try {
    h.row().click();
    h.row().click();
    await settle();
    h.release();
    await settle();
    assert.deepEqual(h.openTerminalCalls, ['s1']);
  } finally { h.destroy(); }
});

test('a click after the open has finished shows the session without opening it again', async () => {
  const h = setup();
  try {
    h.row().click();
    await settle();
    h.release();
    await settle();
    h.row().click();
    await settle();
    assert.deepEqual(h.openTerminalCalls, ['s1']);
  } finally { h.destroy(); }
});

test('a second open of the same session while the first runs gets the first one\'s result', async () => {
  const h = setup();
  try {
    h.window.guardResume = async () => false;
    const first = h.openSession(h.window.sessionMap.get('s1'));
    const second = h.openSession(h.window.sessionMap.get('s1'));
    assert.equal(await first, false);
    assert.equal(await second, false, 'a caller reading the result sees the refusal, not undefined');
    assert.deepEqual(h.openTerminalCalls, []);
  } finally { h.destroy(); }
});

test('once an open has failed, the session can be opened again', async () => {
  const h = setup();
  try {
    h.window.guardResume = async () => false;
    assert.equal(await h.openSession(h.window.sessionMap.get('s1')), false);
    h.window.guardResume = async () => true;
    const opening = h.openSession(h.window.sessionMap.get('s1'));
    await settle();
    h.release();
    await opening;
    assert.deepEqual(h.openTerminalCalls, ['s1']);
  } finally { h.destroy(); }
});
