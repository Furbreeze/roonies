const { app, BrowserWindow, BaseWindow, WebContentsView, protocol } = require('electron/main')
const { spawn } = require('node:child_process')
const axios = require('axios');

const JAVA_PATH = "<your_path_to_java_bin>";
const RUNELITE_PATH = "<your_path_to_java_bin>";
const OSRS_CHARACTER_ID = "<your_acct_id>";
const OSRS_DISPLAY_NAME = "<your_acct_name>";

async function LaunchRunelite(session_id, character_id, display_name) {
  const t = spawn(JAVA_PATH, ['-jar', RUNELITE_PATH], { detached: true, env: { ...process.env, JX_SESSION_ID: session_id, JX_CHARACTER_ID: character_id, JX_DISPLAY_NAME: display_name } });
  await new Promise(resolve => setTimeout(resolve, 1000));
  process.exit()
}


class StringUtils {
  // builds a random PKCE verifier string using crypto.getRandomValues
  static makeRandomVerifier() {
    const t = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const n = new Uint32Array(43);
    crypto.getRandomValues(n);
    return Array.from(n, function (e) {
      return t[e % t.length];
    }).join('');
  }

  // builds a random PKCE state string using crypto.getRandomValues
  static makeRandomState() {
    const t = 0;
    const r = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const n = r.length - 1;

    const o = crypto.getRandomValues(new Uint8Array(12));
    return Array.from(o)
      .map((e) => {
        return Math.round((e * (n - t)) / 255 + t);
      })
      .map((e) => {
        return r[e];
      })
      .join('');
  }
}

class OAuth {
  constructor() {
    this.config = {
      "origin": "https://account.jagex.com",
      "redirect": "https://secure.runescape.com/m=weblogin/launcher-redirect",
      "clientid": "com_jagex_auth_desktop_launcher",
      "auth_api": "https://auth.jagex.com/game-session/v1"
    }
    this.verifier = '';
    this.token = {};
    this.session = {};
    this.nonce = '';
  }

  async getOAuthToken(authCode) {
    const tokenUrl = `${this.config.origin}/oauth2/token`;
    try {
      const response = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientid,
        code: authCode,
        code_verifier: this.verifier,
        redirect_uri: this.config.redirect
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });
      // console.log(response.data);
      this.token = response.data;
    } catch (err) {
      // console.log(err.response.data)
    }
  }

  async getSessionId(id_token) {
    const sessionsUrl = `${this.config.auth_api}/sessions`;
    try {
      const response = await axios.post(sessionsUrl, {
        idToken: id_token
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      // console.log(response.data);
      this.session = response.data;
    } catch (err) {
      // console.log(err.response.data)
    }
  }

  createConsentURL() {
    const nonce = crypto.randomUUID();
    const state = StringUtils.makeRandomState();
    const params = new URLSearchParams({
      id_token_hint: this.token.id_token,
      nonce: nonce,
      prompt: 'consent',
      redirect_uri: 'http://localhost', // needs to be this from production launcher
      response_type: 'id_token code',
      state: state,
      client_id: '1fddee4e-b100-4f4e-b2b0-097f9088f9d2', // hardcoded from production launcher
      scope: 'openid offline'
    });
    this.nonce = nonce;
    const consentUrl = `${this.config.origin}/oauth2/auth?${params.toString()}`;
    // console.log(consentUrl);
    return consentUrl;
  }

  async startOAuthFlow() {
    const state = StringUtils.makeRandomState();
    const verifier = StringUtils.makeRandomVerifier();
    const verifierData = new TextEncoder().encode(verifier);
    const digested = await crypto.subtle.digest('SHA-256', verifierData);
    let raw = '';
    const bytes = new Uint8Array(digested);
    for (let i = 0; i < bytes.byteLength; i++) {
      raw += String.fromCharCode(bytes[i]);
    }
    const codeChallenge = btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const params = new URLSearchParams({
      auth_method: '',
      login_type: '',
      flow: 'launcher',
      response_type: 'code',
      client_id: this.config.clientid,
      redirect_uri: this.config.redirect,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'login',
      scope: 'openid offline gamesso.token.create user.profile.read',
      state: state
    });

    const url = new URL(`${this.config.origin}/oauth2/auth?${params.toString()}`);

    // console.log('INITIAL URL IN START OAUTH FLOW: ' + url.toString());

    this.verifier = verifier;

    const authWindow = new BrowserWindow({
      webPreferences: {
        nodeIntegration: false,
      },
    });

    authWindow.loadURL(url.toString());

  }
}

function parseLocalhostArgs(rawURLString) {
  let args = rawURLString.split('http://localhost/#')[1];
  // console.log('ARGS: ' + args);

  let out = Object.fromEntries(new URLSearchParams(args));
  // console.log(out)

  return out;
}

function parseJagexProtocolArgs(rawURLString) {
  let args = rawURLString.split('jagex:')[1].split(',');
  // console.log('ARGS: ' + args);
  let code = args[0].split('=')[1];
  // console.log('CODE: ' + code);
  return code;
}

// handle exiting
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// create window,
app.whenReady().then(async () => {
  const oauth = new OAuth();

  // handles the jagex:code#<your_code> callback from initial start oauthflow call
  protocol.handle('jagex', async (request) => {
    // console.log('IN PROTOCOL HANDLER: '+ request.url);
    let code = parseJagexProtocolArgs(request.url);

    // retrieves OAuthToken
    await oauth.getOAuthToken(code);
    const oauthConsentURL = oauth.createConsentURL();
    const oauthConsentWindow = new BrowserWindow();

    oauthConsentWindow.webContents.on('will-redirect', async (e, u) => {
      // intercept localhost request from consent redirect, block, and launch
      if (u.indexOf('http://localhost') >= 0) {
        e.preventDefault();

        // console.log(u);
        let consentResponse = parseLocalhostArgs(u);
        // console.log('CONSENT RESPONSE: ' + consentResponse)
        await oauth.getSessionId(consentResponse.id_token);
        // console.log('SESSION ID: ' + oauth.session.sessionId);

        // Launch Runelite
        LaunchRunelite(oauth.session.sessionId, OSRS_CHARACTER_ID, OSRS_DISPLAY_NAME)
      }
    })

    oauthConsentWindow.loadURL(oauthConsentURL);

    return new Response('', {
      status: 200
    })
  })

  // kicks off initial flow
  oauth.startOAuthFlow();
})