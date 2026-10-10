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
      return new Promise((resolve) => releases.push(() => resolve({ ok: true })));
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
    declarations: ['continuationRetryCancelled'],
    functions: ['openSession'],
  });
  window.renderProjects(window.cachedProjects, true);
  const row = () => window.document.getElementById('si-s1');
  const release = () => releases.splice(0).forEach((r) => r());
  return { window, row, openTerminalCalls, release, destroy: () => ctx.destroy() };
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
