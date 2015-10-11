var express = require('express')
  , passport = require('passport')
  , util = require('util')
  , GitHubStrategy = require('passport-github').Strategy
  , ld = require('linked-data-creator-api')
  , dbUrl = 'mongodb://localhost/test2';

var GITHUB_CLIENT_ID = "e71c9f79ab961a823bcc"
var GITHUB_CLIENT_SECRET = "14fe5897e4cb75ddcb0a707e3331e7fdf08bcb10";


// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete GitHub profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the GitHubStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and GitHub
//   profile), and invoke a callback with a user object.
passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    scope: ['repo'],
    callbackURL: 'https://nodejs-linked-data-creator-connoropolous.c9.io/auth/github/callback'
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      profile.accessToken = accessToken;
      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));




var app = express();

// configure Express
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: 'keyboard cat' }));
  // Initialize Passport!  Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});


app.get('/', getSelf, function(req, res){
  res.render('index', { user: req.user, profile: req.profile });
});

app.post('/create_profile', ensureAuthenticated, createProfile);

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

// GET /auth/github
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in GitHub authentication will involve redirecting
//   the user to github.com.  After authorization, GitHubwill redirect the user
//   back to this application at /auth/github/callback
app.get('/auth/github',
  passport.authenticate('github'),
  function(req, res){
    // The request will be redirected to GitHub for authentication, so this
    // function will not be called.
  });

// GET /auth/github/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    console.log(req.user);
    ld.configure({
      token: req.user.accessToken,
      username: req.user.username
    }, function () {
      res.redirect('/');
    });
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

ld.connect(dbUrl, function(err) {
  if (err) return console.log(err);
  app.listen(process.env.PORT, process.env.IP);
  console.log('server started');
});


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}

function getSelf(req, res, next) {
  var url;
  if (req.isAuthenticated()) {
    url = 'https://raw.githubusercontent.com/' + req.user.username +'/open-data-self/master/data.json';
    ld.get(url, function (err, entity) {
      if (err && err.code !== 404) console.log(err);
      else if (err && err.code === 404) {} // do nothing
      else req.profile = entity;
      next();
    });
  }
  else next();
}

function createProfile(req, res) {
  ld.create({
         isSelf: true,
         attrs: {
             type: 'Person',
             url: req.body.url,
             displayName: req.body.displayName,
             image: req.body.image
         }
    }, function (err, entity) {
        if (err) console.log(err);
        res.redirect('/');
    });
}