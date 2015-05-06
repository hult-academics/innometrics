(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*global ElyArray, exports, ElyCore*/

/**
 * @class Ely.Profile
 */

var tools = require('./ElyTools.js');

ElyTools = tools.ElyTools;
ElyArray = tools.ElyArray;

function ElyCore () {};

Ely = {};
Ely.ProfileStorage = function () {};

(function() {
    var root = this,
        Ely = root.Ely,
        core = new ElyCore(),
        queue = [],
        sizeLimiter;

    /**
     * Profile
     * @constructor
     */
    function Profile (){
        this.data = null;
        this.env = {};
        this.listeners = {};
        // if calls for elyProfile already were defined as array of apicalls
        if (root.elyProfile instanceof Array) {
            queue = root.elyProfile;
        }
    }

    Profile.prototype = {};

    /**
     * Precomputed time periods values
     * @type {Object}
     */
    Profile.prototype.PERIOD = {};
    Profile.prototype.PERIOD.SECOND = 1000;
    Profile.prototype.PERIOD.MINUTE = 60 * Profile.prototype.PERIOD.SECOND;
    Profile.prototype.PERIOD.HOUR   = 60 * Profile.prototype.PERIOD.MINUTE;
    Profile.prototype.PERIOD.DAY    = 24 * Profile.prototype.PERIOD.HOUR;
    Profile.prototype.PERIOD.WEEK   = 7 * Profile.prototype.PERIOD.DAY;
    Profile.prototype.PERIOD.MONTH  = 30 * Profile.prototype.PERIOD.DAY;
    Profile.prototype.PERIOD.YEAR   = 365 * Profile.prototype.PERIOD.DAY;


    /**
     * @protected
     * Flag to know when the profile should be initialized and when data can be
     * processed directly, without storing it in the queue
     * @type {Boolean}
     */
    Profile.prototype.ready = false;

    /**
     * @private
     * Profile's data with structure as described in specification
     * @type {Object|null}
     */
    Profile.prototype.data = null;

    /**
     * @protected
     * @type {Object|null}
     */
    Profile.prototype.listeners = null;

    /**
     * Profile's internal Storage
     * @type {null}
     */
    Profile.prototype.storage = null;

    /**
     * @public
     * Profile instance initialization
     * @return {Ely.Profile}
     */
    Profile.prototype.init = function (preventDataAutoload) {
        this.initEnv();
        this.initStorage();
        if (!preventDataAutoload) {
            this.load();
        }
        this.ready = true;
        this.processQueue();
        return this;
    };

    /**
     * @protected
     * Profile's Storage initialization
     * @return {Ely.Profile}
     */
    Profile.prototype.initStorage = function () {
        var storage = new Ely.ProfileStorage();
        return this.setStorage(storage);
    };

    /**
     * @protected
     * Get Profile's Storage instance
     * @return {Ely.ProfileStorage}
     */
    Profile.prototype.getStorage = function () {
        return this.storage;
    };

    /**
     * @protected
     * Set Profile's Storage instance
     * @param {Ely.ProfileStorage} storage
     * @return {Ely.Profile}
     */
    Profile.prototype.setStorage = function (storage) {
        this.storage = storage;
        return this;
    };

    /**
     * @protected
     * @return {Ely.Profile}
     */
    Profile.prototype.initEnv = function () {
        var core = this.getCore(),
            buildInfo = core.config.buildInfo,
            _section = (buildInfo.codename || buildInfo.id),
            section = (_section === null || _section === undefined) ? _section : (''+_section);

        this.env = {
            version:    "1.0",
            companyId:  buildInfo.group,
            app:        'web',
            section:    section
        };

        return this;
    };

    /**
     * @public
     * @param {String} [name]
     * @return {mixed|Object}
     */
    Profile.prototype.getEnv = function (name) {
        var result;
        if (arguments.length > 0) {
            result = this.env[name];
        } else {
            result = merge({}, this.env);
        }
        return result;
    };

    /**
     * @public
     * @param {String|Object}name
     * @param {mixed} value
     * @return {Ely.Profile}
     */
    Profile.prototype.setEnv = function (name, value) {
        if (arguments.length > 1) {
            this.env[name] = value;
        } else if (typeof name === 'object') {
            merge(this.env, name); // key->value pairs
        }

        return this;
    };

    /**
     * @protected
     * @return {Ely.Profile.SizeLimiter}
     */
    Profile.prototype.getSizeLimiter = function () {
        if (!sizeLimiter) {
            sizeLimiter = this.createSizeLimiter();
        }
        return sizeLimiter;
    };

    /**
     * @protected
     * @param {Object} [config]
     * @return {Ely.Profile.SizeLimiter}
     */
    Profile.prototype.createSizeLimiter = function (config) {
        return new Ely.Profile.SizeLimiter(config);
    };

    /**
     *
     * @param {String} id
     * @return {Ely.Profile}
     */
    Profile.prototype.setProfileId = function (id) {
        var data = this.getData();
        data.profileId = id;
        return this;
    };

    /**
     *
     * @return {Ely.Profile}
     */
    Profile.prototype.syncProfileId = function () {
        return this.setProfileId(this.getCore().getVisitorId());
    };

    /**
     * @protected
     * Convert profile data to string representation (serialized JSON)
     * @return {String}
     */
    Profile.prototype.serialize = function () {
        var data = this.getData();
        return this.getCore().toJSON(data);
    };

    /**
     * @public
     * Save Profile data to Storage
     * @return {Ely.Profile}
     */
    Profile.prototype.save = function () {
        this.getSizeLimiter().applyLimits(this);
        this.getStorage().save(this.serialize());
        return this;
    };

    /**
     * @public
     * Load Profile data from Storage
     * @return {Ely.Profile}
     */
    Profile.prototype.load = function () {
        this.loadLocalData();
        this.reorderSessions();
        return this;
    };

    /**
     * @protected
     * Load data from local Storage
     * @return {Ely.Profile}
     */
    Profile.prototype.loadLocalData = function () {
        var data = this.getCore().fromJSON(this.getStorage().load());

        if (!data || data.profileId !== this.getCore().getVisitorId()) {
            data = this.createEmptyData();
        }

        this.loadData(data);
        return this;
    };

    /**
     * @protected
     * @return {Object}
     */
    Profile.prototype.createEmptyData = function () {
        var core = this.getCore();

        return {
            version:   this.getEnv('version'),
            companyId: this.getEnv('companyId'),
            sessions:  [],
            attributes:[],
            profileId: core.getVisitorId()
        };
    };

    /**
     * Clear all Profile's data
     * @param {Boolean} [autosave]
     * @return {Ely.Profile}
     */
    Profile.prototype.clear = function (autosave) {
        this.loadData(this.createEmptyData());
        if (autosave !== false) {
            this.save();
        }
        return this;
    };

    /**
     * @protected
     * Get last (current) Session
     * @return {Object|null}
     */
    Profile.prototype.getLastSession = function (filter) {
        var lastSession,
            now = +(new Date()),
            app = this.getEnv('app'),
            section = this.getEnv('section');

        filter = filter || function (session) {
            return session.collectApp === app && session.section === section;
        };

        lastSession = this.findSession(filter);

        if (lastSession && (now - lastSession.modifiedAt < 1800000)) {
            return lastSession;
        }

        return null;
    };

    /**
     * @protected
     * In the case a session was already created on the PC and we changed domain
     * @return {Object}
     */
    Profile.prototype.updateSessionDataFromPc = function (localSessionId, pcSessionId, pcCreatedAt) {
        var data = this.getData(),
            sessions = data.sessions || [],
            session,
            length = sessions.length,
            i;

        for (i = 0; i < length; i++) {
            session = sessions[i];
            if (session.id === localSessionId) {
                session.id = pcSessionId;
                if (pcCreatedAt) { session.createdAt = pcCreatedAt; }
                break;
            }
        }

        this.save();

        return sessions[i];
    };

    /**
     * @protected
     * @ Reorder sessions bu createdAt field
     * @return {Ely.Profile}
     */
    Profile.prototype.reorderSessions = function () {
        var data = this.getData(),
            sessions = data.sessions || [];

        sessions.sort(function (s1, s2) {
            return s1.createdAt - s2.createdAt;
        });

        return this;
    };

    /**
     * @public
     * Get attribute for certain app and section
     * @param {String} collectApp
     * @param {String} section
     * @return {Object|null}
     */
    Profile.prototype.getAttribute = function (collectApp, section) {
        var data = this.getData(),
            attributes = data.attributes || [],
            attribute,
            i, l = attributes.length,
            result = null;

        for (i=0; i< l; i++) {
            attribute = attributes[i];
            if (attribute.collectApp === collectApp && attribute.section === section) {
                result = attribute;
            }
        }

        return result;
    };

    /**
     * @public
     * Get attribute for current build
     * @return {Object|null}
     */
    Profile.prototype.getCurrentAttribute = function () {
        var app = this.getEnv('app'),
            section = this.getEnv('section');
        return this.getAttribute(app, section);
    };

    /**
     * @protected
     * Add new attribute
     * @param currentAttribute
     * @param  fromCloud boolean describing if attributes should be sent to cloud
     * @return {Ely.Profile}
     */
    Profile.prototype.addAttribute = function (currentAttribute) {
        var data = this.getData(),
            attributes;
        attributes = (data.attributes = data.attributes || []);
        attributes.push(currentAttribute);
        // if (fromCloud) {
        //     this.fireEvent('add_attribute');
        // }
        return this;
    };

    /**
     * @protected
     * @return {Object}
     */
    Profile.prototype.createAttributeContainer = function () {
        return {
            collectApp: this.getEnv('app'),
            section:    this.getEnv('section'),
            data:       {}
        };
    };

    /**
     * @public
     * Get stored variable from attribute
     * @param {String} key
     * @param {String} [section]
     * @param {String} [app]
     * @return {mixed}
     */
    Profile.prototype.getUserData = function (key, section, app) {
        section = section || this.getEnv('section');
        app = app || this.getEnv('app');

        var attribute = this.getAttribute(app, section) || {},
            vars = attribute.data || {};

        return vars[key];
    };

    /**
     * @public
     * Set variable to attribute
     * @param {String} key
     * @param {mixed} value
     * @param {Boolean} [autosave]
     * @param {Boolean} [syncWithCloud]
     * @return {Ely.Profile}
     */
    Profile.prototype.setUserData = function (key, value, autosave, syncWithCloud) {
        if (!this.getSizeLimiter().checkAttributeDataValueSize(value)) {
            /*@ if !live @*/
            this.showDebugMessage('Attribute data value "'+key+'" has not been set (size of value is too big)', 'warn');
            /*@ fi @*/
            return this;
        }

        var attribute = this.getCurrentAttribute(),
            attributeIsNew = false,
            vars;

        if (!attribute) {
            attribute = this.createAttributeContainer();
            attributeIsNew = true;
        }

        vars = (attribute.data = attribute.data || {});
        vars[key] = value;

        if (attributeIsNew) {
            this.addAttribute(attribute);
        }

        if (autosave !== false) {
            this.save();
        }

        this.fireEvent('set_user_data', key, value, {
            syncWithCloud: syncWithCloud !== false
        });
        return this;
    };

    /**
     * Push value to "array"-variable in attribute
     * @param {String} key
     * @param {mixed} value
     * @param {Boolean} [autosave]
     * @return {Ely.Profile}
     */
    Profile.prototype.pushUserData = function (key, value, autosave) {
        // TODO
        if (!this.getSizeLimiter().checkAttributeDataValueSize(value)) {
            /*@ if !live @*/
            this.showDebugMessage('Attribute data value "'+key+'" has not been set (size of value is too big)', 'warn');
            /*@ fi @*/
            return this;
        }

        var v = this.getUserData(key);
        if (!ElyTools.isArray(v)) { // variable does not exist or is not Array
            v = [value];
            this.setUserData(key, v, autosave);
        } else {
            v.push(value);
            if (autosave !== false) {
                this.save();
            }
        }
        this.fireEvent('push_user_data', key, value);
        return this;
    };

    /**
     * @public
     * Get session data by name
     * @param {String} key
     * @return {mixed}
     */
    Profile.prototype.getSessionData = function (key) {
        var session = this.getLastSession() || {},
            vars = session.data || {};
        return vars[key];
    };

    /**
     * @public
     * Set data to session
     * @param {String} key
     * @param {mixed} value
     * @param {Boolean} [autosave]
     * @param {Boolean} [syncWithCloud]
     * @return {Ely.Profile}
     */
    Profile.prototype.setSessionData = function (key, value, autosave, syncWithCloud) {
        if (!this.getSizeLimiter().checkSessionDataValueSize(value)) {
            /*@ if !live @*/
            this.showDebugMessage('Session data value "'+key+'" has not been set (size of value is too big)', 'warn');
            /*@ fi @*/
            return this;
        }

        var session = this.getLastSession() || this.addSession(null, autosave),
            vars;

        vars = (session.data = session.data || {});
        vars[key] = value;

        if (autosave !== false) {
            this.save();
        }

        this.fireEvent('set_session_data', key, value, {
            syncWithCloud: syncWithCloud !== false
        });
        return this;
    };

    /**
     * @public
     * Push data to session
     * @param {String} key
     * @param {mixed} value
     * @param {Boolean} [autosave]
     * @return {Ely.Profile}
     */
    Profile.prototype.pushSessionData = function (key, value, autosave) {
        // TODO
        if (!this.getSizeLimiter().checkSessionDataValueSize(value)) {
            /*@ if !live @*/
            this.showDebugMessage('Session data value "'+key+'" has not been set (size of value is too big)', 'warn');
            /*@ fi @*/
            return this;
        }

        var v = this.getSessionData(key);
        if (!ElyTools.isArray(v)) { // variable does not exist or is not Array
            v = [value];
            this.setSessionData(key, v, autosave);
        } else {
            v.push(value);
            if (autosave !== false) {
                this.save();
            }
        }
        this.fireEvent('push_session_data', key, value);
        return this;

    };

    /**
     * @protected
     * Format a session by removing events in order to sent it directly to PC
     * @param  {Object} session Session containing events
     * @return {Object}         Session /w events
     */
    Profile.prototype.extractSessionData = function(session) {
        return {
            collectApp: session.collectApp,
            createdAt:  session.createdAt,
            modifiedAt: session.modifiedAt,
            data:       merge({}, session.data),
            section:    session.section,
            id:         session.id
        };
    };

    /**
     * Find session by id
     * @param {String} sessionId
     * @return {Object|null}
     */
    Profile.prototype.getSessionById = function (sessionId) {
        return this.findSession(function (session) {
            return (session && session.id === sessionId);
        });
    };

    /**
     *
     * @param {Function} filter
     * @return {Object|null}
     */
    Profile.prototype.findSession = function (filter) {
        if (typeof filter !== 'function') {
            throw new Error('Filter should be a function');
        }

        var data = this.getData(),
            sessions = data.sessions || [],
            session,
            i=sessions.length,
            result = null;

        for (;i--;) {
            session = sessions[i];
            if (filter(session)) {
                result = session;
                break;
            }
        }

        return result;
    };

    Profile.prototype.pushEventsInSession = function (localSession, pcSession) {
        var i = 0, j = 0, eventExists,
            ltLocal = localSession.events.length,
            ltPc = pcSession.events.length;

        for (; i < ltPc; i++) {
            eventExists = false;
            for (j = 0; j < ltLocal; j++) {
                if (localSession.events[j].id === pcSession.events[i].id) {
                    eventExists = true;
                }
            }
            if (!eventExists) {
                localSession.events.push(this.getSizeLimiter().applyEventLimit(pcSession.events[i]));
            }
        }

        localSession.events.sort(function (event1, event2) {
            return event1.createdAt - event2.createdAt;
        });

        localSession.modifiedAt = localSession.events[localSession.events.length - 1].createdAt;

        this.save();
    };
    /**
     * @public
     * Add new Event to Profile data
     * @param {Object} event
     * @param {Boolean} [autosave]
     * @param {Object} [metadata] some data will be thrown with event "add_event"
     * @return {Ely.Profile}
     */
    Profile.prototype.addEvent = function (event, autosave, metadata) {
        var lastSession = this.getLastSession(),
            e;
        if (!lastSession) {
            lastSession = this.createSession();
            this.addSession(lastSession, false);
        }

        this.getSizeLimiter().applyEventLimit(event);

        lastSession.events = lastSession.events || [];
        lastSession.events.push(event);
        lastSession.modifiedAt = +new Date();

        if (autosave !== false) {
            this.save();
        }

        // prepare data for fireEvent
        e = merge({}, event);
        metadata = metadata || {};
        metadata.session = lastSession;
        metadata.session_data = this.extractSessionData(lastSession);
        this.fireEvent('add_event', e, metadata);
        return this;
    };

    /**
     *
     * @param {Object} session
     * @param {Boolean} [autosave]
     * @return {Object}
     */
    Profile.prototype.addSession = function (session, autosave, reorderSessions) {
        var data = this.getData();

        if (session) {
            this.getSizeLimiter().applySessionLimit(session);
        }

        session = session || this.createSession();
        data.sessions.push(session);

        if (reorderSessions) {
            this.reorderSessions();
        }

        if (autosave !== false) {
            this.save();
        }

        return session;
    };

    /**
     * Create new empty Session object
     * @param {Number} [time] timestamp for new session
     * @return {Object}
     */
    Profile.prototype.createSession = function (time) {
        var core = this.getCore();

        time = time || +core.timeInit;

        return {
            id:  generateSeed(10),
            collectApp: this.getEnv('app'),
            section:    this.getEnv('section'),
            data:       this.getDefaultSessionData(),
            modifiedAt: time,
            createdAt:  time,
            events:     []
        };
    };

    /**
     * @protected
     * @return {Object}
     */
    Profile.prototype.getDefaultSessionData = function () {
        return {
            userAgent: navigator.userAgent
        };
    };

    /**
     * @public
     * @param {ElyBRule} rule
     * @return {Ely.Profile}
     */
    Profile.prototype.addTriggeredRule = function (rule) {
        var data = this.getDataFromRule(rule, function (data) {
                return !!data.save_to_profile;
            }),
            event = this.createEventFromRule(rule);

        this.saveDataFromRule(data, false);

        return this.addEvent(event, true, {
            syncWithCloud: !!rule.syncWithCloud,
            rule: rule
        });
    };

    /**
     * @protected
     */
    Profile.prototype.saveDataFromRule = function (data, autosave) {
        var setters = {
                "session":  'setSessionData',
                "user":     'setUserData'
            },
            setter, scope,
            profile = this;

        data = data || {};

        for (scope in data) {
            if (data.hasOwnProperty(scope)) {
                setter = setters[scope];
                if (!setter) {
                    continue;
                }
                ElyTools.each(data[scope], setData, {setterName: setter});
            }
        }

        if (autosave !== false) {
            this.save();
        }

        return this;

        function setData (value, name) {
            var setterName = this.setterName;
            profile[setterName](name, value, false);
        }
    };

    /**
     *
     * @param {ElyBRule} rule
     * @param {Function} [filter]
     * @return {Object}
     */
    Profile.prototype.getDataFromRule = function (rule, filter) {
        var data = {};

        ElyTools.each(rule.dataDimensions || [], function (dd) {
            if (typeof filter === 'function' && !filter(dd)) {
                return;
            }

            var scope = dd.scope || 'event',
                type = dd.result_type,
                value = dd.value,
                name = dd.codename || dd.logic;

            if (dd.hasOwnProperty('scope:target_name')) {
                name = dd['scope:target_name'];
            }

            if (type) {
                value = ElyTools.castTo(value, type);
            }

            this[scope] = this[scope] || {};
            this[scope][name] = value;

        }, data);

        return data;
    };

    /**
     * @protected
     * @param {ElyBRule} rule
     * @return {Object}
     */
    Profile.prototype.createEventFromRule = function (rule) {
        var now = +new Date(),
            values = {};

        ElyTools.each(rule.dataDimensions || [], function (dd) {
            if (!dd.save_to_profile) { return; }
            if (dd.scope && dd.scope !== 'event') { return; }

            var type = dd.result_type,
                value = dd.value,
                name = dd.id || dd.codename || dd.logic;

            if (type) {
                value = ElyTools.castTo(value, type);
            }

            values[name] = value;
        }, values);

        return {
            id:                 generateSeed(),
            definitionId:  rule.codename,
            createdAt:          now,
            data:               values
        };
    };

    /**
     * @public
     * Inject Core to Profile instance
     * @param {Ely.Core} elyCore
     * @return {Ely.Profile}
     */
    Profile.prototype.setCore = function (elyCore) {
        if (!(elyCore instanceof ElyCore)) {
            throw new TypeError('Core should be instance of ElyCore');
        }
        core = elyCore;
        return this;
    };

    /**
     * @public
     * Get injected Core
     * @return {Ely.Core|null}
     */
    Profile.prototype.getCore = function () {
        return core;
    };

    /**
     * @public
     * fct intended to replace the Array.prototype.push => shouldn't be renamed
     * depending on the state of the initialization of the IQL it will continnue
     * to push it inside of _queue or directly process it
     * @param  {Function} fn fct to be processed
     */
    Profile.prototype.push = function (fn) {
        var result;

        if (!this.ready) {
            queue.push(fn);
        } else {
            result = this.executeFn(fn);
        }

        return result;
    };


    /**
     * fct called by the CscAdapter, allowing to initializes data and associated
     * functions
     * @param {Object} data Plain object formated as described in API
     */
    Profile.prototype.loadData = function (data) {
        var lastEvent, lastSession, fullProfile, sessions, events;
        if (data) {

            this.setData(data);

            // Stores internally the profile and provide copy each time a query is made
            Profile.prototype.getFullProfile = (function (data) {
                return function getFullProfile (query) {
                    query = query || {};
                    query = merge(query, data);
                    return query;
                };
            })(data);

            // logic to store inside of the adapter the last saved event ID
            // So that we can efficiently know each time a the executeFn function
            // is called if we should update the stored data
            fullProfile = Profile.prototype.getFullProfile();
            sessions = fullProfile.sessions || [];
            lastSession = sessions[sessions.length - 1];
            if (lastSession) {
                events = lastSession.events || [];
                lastEvent = events[events.length - 1];
            }
            Profile.prototype.getLastSavedEventId = (function (id) {
                return function getLastSavedEventId () {
                    return id;
                };
            })(lastEvent ? lastEvent.id: null);

            // check to call only the initProfile once, after it has been called
            //  by ely.trackerReady()
            if (Profile.prototype.ready === false) {
                this.processQueue();
            }
        }
        Profile.prototype.ready = true;
    };

    /**
     * Get Profile's data
     * @return {Object|null}
     */
    Profile.prototype.getData = function () {
        return this.data;
    };

    /**
     * Set Profile's data
     * @param {Object} data
     * @return {Ely.Profile}
     */
    Profile.prototype.setData = function (data) {
        this.data = data;
        return this;
    };

    /**
     * @public
     * Clone Profile instance and its included data
     * @return {Ely.Profile}
     */
    Profile.prototype.clone = function () {
        var profile = new Profile(),
            data = merge({}, this.getData());

        profile.setCore(this.getCore());
        profile.initStorage();
        profile.setData(data);

        return profile;
    };

    /**
     * @protected
     * Execute function and return its result
     * (used in Profile.processQueue and Profile.push methods)
     * @param {Function} fn
     * @return {mixed|undefined}
     */
    Profile.prototype.executeFn = function (fn) {
        return (typeof fn === 'function') ? fn(this) : undefined;
    };

    /**
     * @protected
     * Execute functions stores in predefinen queue
     * (calls after Profile has been initialized)
     * @return {Ely.Profile}
     */
    Profile.prototype.processQueue = function () {
        var q = (queue && typeof queue.shift === 'function') ? queue : [], // looks like Array or not
            fn;

        while ((fn = q.shift())) {
            this.executeFn(fn);
        }

        return this;
    };

    /**
     * @public
     * get the full stored profile without filtration
     * needed if no other function is passed
     * @return {Object} API described
     */
    Profile.prototype.get = function () {
        return Profile.prototype.createFilteredProfile(this);
    };

    /**
     * Internal query function initializing the profile at the first function call
     * @return {Profile}
     */
    Profile.prototype.createFilteredProfile = function () {
        var profile = new Profile();
        profile = Profile.prototype.getFullProfile(profile);

        profile.sessions.untouched = profile.attributes.untouched = true;
        return profile;
    };

    /**
     *
     * @return {Ely.Profile}
     */
    Profile.prototype.getQuery = function () {
        var query = this;
        if (!query.isQuery()) {
            query = this.clone();
            query = merge(query, query.getData());
            query.sessions.untouched = query.attributes.untouched = true;
            query._isQuery = true;
        }
        return query;
    };

    /**
     * @protected
     * Check if instance is Query instance
     * @return {Boolean}
     */
    Profile.prototype.isQuery = function () {
        return !!this._isQuery;
    };

    /**
     * Apply collectApp-filter and return filtered Profile
     * @param {String} collectApp
     * @return {Ely.Profile}
     */
    Profile.prototype.collectApp = function (collectApp) {
        var query = this.getQuery(),
            untouched;

        untouched = query.attributes.untouched;
        query.attributes = ElyArray.filter(query.attributes || [], function (res) {
            return (res.collectApp === collectApp);
        });
        query.attributes.untouched = untouched;

        untouched = query.sessions.untouched;
        query.sessions = ElyArray.filter(query.sessions || [], function (res) {
            return (res.collectApp === collectApp);
        });
        query.sessions.untouched = untouched;

        return query;
    };

    /**
     * Filter data by Section
     * @param section
     * @return {Ely.Profile}
     */
    Profile.prototype.section = function (section) {
        var query = this.getQuery(),
            untouched;

        untouched = query.attributes.untouched;
        query.attributes = ElyArray.filter(query.attributes, function (value) {
            return (value.section === section);
        });
        query.attributes.untouched = untouched;

        untouched = query.sessions.untouched;
        query.sessions = ElyArray.filter(query.sessions, function (sectionData) {
            return (sectionData.section === section);
        });
        query.sessions.untouched = untouched;

        return query;
    };

    /**
     * Filter data by event
     * @param eventName
     * @return {Ely.Profile}
     */
    Profile.prototype.event = function (eventName) {
        var query = this.getQuery();

        query.sessions = ElyArray.filter(query.sessions, function (session) {
            session.events = ElyArray.filter(session.events, function (event) {
                return (event.definitionId === eventName);
            });
            return !!session.events.length;
        });

        query.sessions.untouched = false;

        return query;
    };

    Profile.prototype.withEventData = function (field) {
        var query = this.getQuery();

        query.sessions = ElyArray.filter(query.sessions, function (session) {
            session.events = ElyArray.filter(session.events, function (event) {
                return (event.data.hasOwnProperty(field));
            });
            return !!session.events.length;
        });

        query.sessions.untouched = false;

        return query;
    };

    /**
     * Filter by eventDara
     * @param field
     * @return {Ely.Profile}
     */
    Profile.prototype.eventData = function (field) {
        var query = this.getQuery();
        query.evField = field;
        return query;
    };

    /**
     *
     * @param field
     * @return {Ely.Profile}
     */
    Profile.prototype.userData = function (field) {
        var query = this.getQuery();
        query.usField = field;
        return query;
    };

    /**
     * Alias to "userData" filter
     * (userData was renamed to attributeData, userData is deprecated)
     * @param field
     * @return {Ely.Profile}
     */
    Profile.prototype.attributeData = function (field) {
        return this.userData(field);
    };

    /**
     *
     * @param field
     * @return {Ely.Profile}
     */
    Profile.prototype.sessionData = function (field) {
        var query = this.getQuery();
        query.sesField = field;
        return query;
    };

    /**
     *
     * @param max
     * @param min
     * @return {Boolean}
     */
    Profile.prototype.eventFrequency = function (min, max) {
        var query = this.getQuery();
        return !!query.getEventFrequency(min, max);
    };



    /**
     *
     * @param entry
     * @return {*}
     */
    Profile.prototype.eq = function (entry) {
        return this.comparator(this, entry, function (a, b){
            return a === b;
        });
    };

    /**
     *
     * @param entry
     * @return {*}
     */
    Profile.prototype.neq = function (entry) {
        return this.comparator(this, entry, function (a, b){
            return a !== b;
        });
    };

    Profile.prototype.gte = function (entry) {
        return this.comparator(this, entry, function (a, b){
            return a >= b;
        });
    };

    Profile.prototype.gt = function (entry) {
        return this.comparator(this, entry, function (a, b){
            return a > b;
        });
    };

    Profile.prototype.lte = function (entry) {
        return this.comparator(this, entry, function (a, b){
            return a <= b;
        });
    };

    Profile.prototype.lt = function (entry) {
        return this.comparator(this, entry, function (a, b){
            return a < b;
        });
    };

    Profile.prototype.starts = function (entry) {
        return this.comparator(this, entry, function (a, b) {
            return a.indexOf(b) === 0;
        });
    };

    Profile.prototype.ends = function (entry) {
        return this.comparator(this, entry, function (a, b) {
            return a.indexOf(b, a.length - b.length) !== -1;
        });
    };

    Profile.prototype.contains = function (entry) {
        return this.comparator(this, entry, function (a, b) {
            return a.indexOf(b) !== -1;
        });
    };

    Profile.prototype.filter = function (entry, fn) {
        return this.comparator(this, entry, fn);
    };

    /**
     *
     * @param {Ely.Profile} query
     * @param {mixed} entry
     * @param {Function} handler
     * @return {Ely.Profile}
     */
    Profile.prototype.comparator = function (query, entry, handler) {

        if (!query.evField && !query.usField && !query.sesField) {
            return null;
        }

        if (query.evField) {
            query.sessions = ElyArray.filter(query.sessions, function (value) {
                value.events = ElyArray.filter(value.events, function (event) {
                    var data = event.data[query.evField];
                    return (data === null || data === undefined) ? false : (handler(data, entry));
                });
                return !!value.events.length;
            });
            query.sessions.untouched = false;
        }

        if (query.usField) {
            query.attributes = ElyArray.filter(query.attributes, function (attribute) {
                var data = attribute.data[query.usField];
                return (data === null || data === undefined) ? false : (handler(data, entry));
            });
            query.attributes.untouched = false;
        }

        if (query.sesField) {
            query.sessions = ElyArray.filter(query.sessions, function (session) {
                try {
                    return handler(session.data[query.sesField], entry);
                } catch (e) {
                    return false;
                }
            });
            query.sessions.untouched = false;
        }

        delete query.evField;
        delete query.usField;
        delete query.sesField;

        return query;
    };

    Profile.prototype.exists = function () {
        var query = this.getQuery(),
            sessions = query.sessions,
            attributes = query.attributes;

        /*
        // all untouched
        if (sessions.untouched && attributes.untouched) {
            return !!(sessions.length && attributes.length);
        }
        */

        // sessions modified and attributes untouched
        if (!sessions.untouched && attributes.untouched) {
            return !!sessions.length;
        }

        // attributes modified and sessions untouched
        if (!attributes.untouched && sessions.untouched) {
            return !!attributes.length;
        }

        // both (sessions and attributes) modified or untouched
        return !!(sessions.length && attributes.length);
    };

    Profile.prototype.eventExists = function () { // TODO deprecated?
        var query = this.getQuery();
        return !!query.sessions.length;
    };

    Profile.prototype.userDataExists = function () { // TODO deprecated?
        var query = this.getQuery();
        return !!query.attributes.length;
    };


    // evField need to be a string
    Profile.prototype.getEventDataOrdered = function (evField, order) {
        var query = this.getQuery(),
            storingObj = {},
            valueName = "",
            count = 0,
            retArr = [], i, prop, reference;

        if (!evField) {
            return null;
        }

        ElyTools.each(query.sessions, function (session) {
            ElyTools.each(session.events, function (event) {
                var key = event.data[evField];
                storingObj[key] = Number(storingObj[key]) + 1;
                count++;
            });
        });

        for (i = 0; i < count; i++) {
            reference = order ? Number.MAX_VALUE : 0;
            valueName = "";
            if (order) {
                for (prop in storingObj) {
                    if(storingObj.hasOwnProperty(prop) && storingObj[prop] < reference){
                        valueName = prop;
                        reference = storingObj[prop];
                    }
                }
            } else {
                for (prop in storingObj) {
                    if(storingObj.hasOwnProperty(prop) && storingObj[prop] > reference){
                        valueName = prop;
                        reference = storingObj[prop];
                    }
                }
            }

            if (valueName) {
                retArr.push(valueName);
                delete storingObj[valueName];
            }
        }

        return retArr;
    };

    Profile.prototype.getEventData = function () {
        var query = this.getQuery(),
            i, j, k, jlt, klt, session,
            eventDataArray = [],
            valueArray = [];
        i = j = k = 0;

        for (; i < arguments.length; i++) {
            valueArray = [];
            for (j = 0, jlt = query.sessions.length; j < jlt; j++) {
                session = query.sessions[j];
                for (k = 0, klt = session.events.length; k < klt; k++) {
                    valueArray.push(session.events[k].data[arguments[i]]);
                }
            }
            eventDataArray.push(valueArray);
        }

        return eventDataArray;
    };

    Profile.prototype.getEventFrequency = function (min, max) {
        var query = this.getQuery(),
            count = query.getEventCount();

        min = min || 0;
        max = max || Number.MAX_VALUE;

        return min <= count && count <= max;
    };

    Profile.prototype.getEventCount = function () {
        var query = this.getQuery(),
            count = 0;

        ElyTools.each(query.sessions, function (session) {
            count += session.events.length;
        });

        return count;
    };

    Profile.prototype.getEvents = function () {
        var query = this.getQuery(),
            events = [];

        ElyTools.each(query.sessions, function (session){
            events = events.concat(session.events);
        });

        return events;
    };

    Profile.prototype.inLast = function (period, to, from) {

        var periodSubject,
            periodType,
            multiplier,
            toTs, fromTs,
            query, tempSess,
            i, j,
            now = +new Date();

        period = period.split('.');

        periodSubject = period[0];
        periodType = period[1];

        query = this.getQuery();

        if (periodType) {

            multiplier = this.PERIOD[periodType.toUpperCase()] || 1;
            to *= multiplier;
            from = from || 0;
            from *= multiplier;

            fromTs = now - to; // NOTE: fromTs older than toTs
            toTs = now - from; //

            query = query.betweenDates(periodSubject, fromTs, toTs);

        } else {
            switch (periodSubject) {
                case 'sessions':
                    i = from || 1;
                    j = to || 1;
                    // First in all sessions, only keeping the ones matching
                    // query parameters
                    tempSess = this.data.sessions.
                                sort(function (s1, s2) {
                                    return s2.createdAt - s1.createdAt;
                                }).
                                slice(i-1, j).
                                reverse();
                    // We compare the kept sessions to the one already filtered
                    // by the query and keep only the one present in both arrays
                    query.sessions = ElyArray.filter(query.sessions, function (session) {
                        var lt;
                        for (i = 0, lt = tempSess.length; i < lt; i++) {
                            if (session.id === tempSess[i].id){
                                return true;
                            }
                            return false;
                        }
                    });
                    query.sessions.untouched = false;
                    break;

                case 'events':
                    from = from || 1;
                    i = from;
                    query.sessions.sort(function (s1, s2) { return s2.createdAt - s1.createdAt; });
                    query.sessions = ElyArray.filter(query.sessions, function (session) {
                        var events = [];
                        j = session.events.length;
                        if (i===from) {
                            j-= i-1;
                        }
                        while (i<=to && j--) {
                            events.push(session.events[j]);
                            i++;
                        }
                        session.events = events.reverse();
                        return !!session.events.length;
                    });
                    query.sessions.untouched = false;
                    break;
            }

        }

        return query;
    };

    /**
     *
     * @param {String} subject
     * @param {String} firstDate
     * @param {String} secondDate
     * @return {Ely.Profile}
     */
    Profile.prototype.betweenDates = function (subject, firstDate, secondDate) {
        var query = this.getQuery(),
            filter,
            from, to;


        from = firstDate;
        to = secondDate;

        if (typeof from !== 'number') {
            from = +parseDate(firstDate);
        }
        if (typeof to !== 'number') {
            to = +parseDate(secondDate);
        }

        if (!isNaN(from) && !isNaN(to)) {
            switch (subject.toLowerCase()) {
                case 'sessions':
                    filter = function (session) {
                        return (session.createdAt >= from && session.createdAt <= to);
                    };
                    break;

                case 'events':
                    filter = function (session) {
                        session.events = ElyArray.filter(session.events, function (event) {
                            return (event.createdAt >= from && event.createdAt <= to);
                        });
                        return !!session.events.length;
                    };
                    break;

                default:
                    return query;
            }
        }

        if (typeof filter === 'function') {
            query.sessions = ElyArray.filter(query.sessions, filter);
            query.sessions.untouched = false;
        }

        return query;
    };


    Profile.prototype.byDay = function (day) {
        var query = this.getQuery();

        query.sessions = ElyArray.filter(query.sessions, function (session) {
            session.events = ElyArray.filter(session.events, function (event) {
                return ((new Date(event.createdAt)).getDay() === day);
            });
            return !!session.events.length;
        });

        query.sessions.untouched = false;

        return query;
    };

    /**
     * @public
     * Subscribe to event
     * @param {String} event
     * @param {Function} callback
     * @param {mixed} [context]
     * @return {Boolean}
     */
    Profile.prototype.on = function (event, callback, context) {
        if (typeof callback !== 'function') {
            return false;
        }
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        callback.context = context;
        this.listeners[event].push(callback);
        return true;
    };

    /**
     * Unsibscribe from event
     * @param {String} event
     * @param {Function} callback
     */
    Profile.prototype.un = function (event, callback) {
        var listeners = this.listeners[event] || [],
            index = ElyArray.inArray(listeners, callback);

        if (~index) {
            listeners.splice(index, 1);
        }
    };

    /**
     * @protected
     * Call all listeners which subscribed to the event
     * @param {String} event
     */
    Profile.prototype.fireEvent = function (event) {
        var listeners = this.listeners[event] || [],
            i, l = listeners.length,
            callback,
            args;

        if (!l) { return; }

        args = Array.prototype.slice.call(arguments, 1);

        for (i=0; i<l; i++) {
            callback = listeners[i];
            if (typeof callback === 'function') {
                callback.apply((callback.context || null), args);
            }
        }
    };

    /**
     * This function should be used on 2 filtered results in order to associated them
     * duplicates in both results will be removed
     * @param {Ely.Profile} profile1
     * @param {Ely.Profile} profile2
     * @return {Object}
     */
    /* // TMP not used
    Profile.prototype.join = function (profile1, profile2) {
        return {
            version     : profile1.version,
            profileId   : profile1.profileId,
            companyId   : profile1.companyId,
            sessions    : Profile.mergeSessions(profile1.sessions, profile2.sessions),
            attributes  : Profile.prototype.mergeUserData(profile1.attributes, profile2.attributes)
        };
    };
    */

    // Some static methods

    /**
     * Merge event from session1 to session2
     * (note! session1 will be modified by function)
     * @param {Object} session1
     * @param {Object} session2
     * @return {*}
     */
    Profile.mergeEvents = function (session1, session2) {
        var i, l,
            mergedEvents,
            finalEvents = [],
            event1, event2;

        // no need to check the number of events

        mergedEvents = (session1.events || []).concat(session2.events || []);
        mergedEvents.sort(function (event1, event2) {
            return event1.createdAt - event2.createdAt;
        });

        for (i = 0, l = mergedEvents.length; i < l; i++) {
            event1 = mergedEvents[i];
            event2 = mergedEvents[i+1];
            finalEvents.push(event1);
            if (event2 && event1.id === event2.id) {
                i++;
            }
        }
        session1.events = finalEvents;

        return session1;
    };

    /**
     * Merge 2 sessions results
     * @param {Array} sessions1
     * @param {Array} sessions2
     * @return {*}
     */
    /* // TMP not used
    Profile.mergeSessions = function (sessions1, sessions2) {
        var i, l,
            mergedSessions,
            finalSessions,
            session1, session2;

        // handling if one or both result sessions are empty
        if (!sessions1.length || !sessions2.length) {
            return [].concat(sessions1, sessions2);
        }

        mergedSessions = sessions1.concat(sessions2);
        mergedSessions.sort(function (session1, session2) {
            return session1.createdAt - session2.createdAt;
        });

        finalSessions = [];
        for (i = 0, l = mergedSessions.length; i < l; i++) {
            session1 = mergedSessions[i];
            session2 = mergedSessions[i+1];

            if (session2 && session1.id === session2.id) {
                session1 = Profile.mergeEvents(session1, session2);
                i++;
            }

            finalSessions.push(session1);
        }
        return finalSessions;
    };
    */

    /**
     * Merge 2 sections results
     * @param {Array} sections1
     * @param {Array} sections2
     * @return {*}
     */
    Profile.mergeSections = function (sections1, sections2) {
        var i, l,
            mergedSections,
            finalSections,
            sectionData1, sectionData2;

        if (!sections1.length || !sections2.length) {
            return [].concat(sections1, sections2);
        }

        mergedSections = sections1.concat(sections2);
        mergedSections.sort(function (sectionData1, sectionData2) {
            var s1 = sectionData1.section,
                s2 = sectionData2.section;

            return (s1 === s2) ? 0 : (s1 > s2 ? 1 : -1);
        });

        finalSections = [];
        for (i = 0, l = mergedSections; i < l; i++) {
            sectionData1 = mergedSections[i];
            sectionData2 = mergedSections[i + 1];

            if (sectionData2 && sectionData1.section === sectionData2.section) {
                i++;
            }

            finalSections.push(sectionData1);
        }

        return finalSections;
    };

    /**
     * Merge 2 userData results
     * @param userData1
     * @param userData2
     * @return {*}
     */
    Profile.prototype.mergeUserData = function (userData1, userData2) {
        var prop;

        for (prop in userData2) {
            if (userData2.hasOwnProperty(prop)) {
                userData1[prop] = userData2[prop];
            }
        }

        return userData1;
    };

    /*@ if !live @*/
    Profile.prototype.showDebugMessage = function (message, type) {
        var methods = {log: 'log', warn: 'warn', 'warning': 'warn', error: 'error'},
            method = methods[type] || 'log';
        if (root.console) {
            root.console[method](message);
        }
    };
    /*@ fi @*/

    Profile.prototype.getStorageUsage = function () {
        return this.getSizeLimiter().getUsage(this);
    };

    Profile.prototype.getStorageUsagePercent = function () {
        return this.getSizeLimiter().getUsagePercent(this);
    };


    var clone = ElyTools.clone;

    /**
     * Utility function for merge Objects
     * @param destination
     * @return {*}
     */
    function merge (destination) {
        var i = 1,
            ln = arguments.length,
            object, key, value;

        for (; i < ln; i++) {
            object = arguments[i];

            for (key in object) {
                if (object.hasOwnProperty(key)) { // remove this if merging works wrong
                    value = object[key];
                    if (value && value.constructor === Object) {

                        destination[key] = destination[key] || (new value.constructor());
                        merge(destination[key], value); // recursive

                    } else if (value && value.constructor === Array) {

                        destination[key] = clone(value);

                    } else {
                        destination[key] = value;
                    }
                }
            }
        }
        return destination;
    }

    function parseDate (date_str) {
        return new Date(('' + date_str).replace(/-/g,"/").replace(/[TZ]/g," "));
    }

    function generateSeed (n) {
        return ElyTools.generateSeed(n);
    }

    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            //exports = module.exports = profile; // jsHint said that exports is readonly
            module.exports = new Profile();
        }
    }/* else {
        root.elyProfile = profile;
    }*/

    // Ely.namespace(root,'Ely.Profile', Profile);

})();

},{"./ElyTools.js":2}],2:[function(require,module,exports){
/*jshint forin: false*/
/**
 * @namespace ElyTools
 * host for all utility functions
 */

var ElyTools = {};
this.ElyArray = ElyArray;

this.ElyTools = (function () {

	/**
     * Do a shallow copy of all source's properties into destination
     * @param {Object} destination output
     * @param {Object} source input
     * @type {Object} destination
     */
	function extend (destination, source) {
        var property;
		for (property in source) {
			destination[property] = source[property];
        }
		return destination;
	}

    var toString = Object.prototype.toString;
    function clone(item) {
        var type, i, cloned, key;

        if (item === null || item === undefined) {
            return item;
        }

        type = toString.call(item);

        // Array
        if (type === '[object Array]') {
            i = item.length;
            cloned = [];
            while (i--) {
                cloned[i] = clone(item[i]);
            }
        }
        // Object
        else if (type === '[object Object]' && item.constructor === Object) {
            cloned = {};
            for (key in item) {
                if (item.hasOwnProperty(key)) {
                    cloned[key] = clone(item[key]);
                }
            }
        }

        return cloned || item;
    }

	/**
     * ecma5 Object.keys shim
     * @see on <a href="https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Object/keys">MDN</a>
     * @param {Object} object to process
     * @param {boolean} forceCustom force calling pure-js code,
     *			even if ecma5's Object.keys is present
     * @type {Array.<string>}
     */
	function keys (object, forceCustom) {
        if (typeof object !== 'object' || object === null) {
            return [];
        }
		if (!forceCustom && Object.keys) {
			return Object.keys(object);
        }
		var results = [];
        var property;
		for (property in object) {
			if (object.hasOwnProperty(property)) {
				results.push(property);
			}
		}
		return results;
	}

	/**
     * Gets cookie value by its name
     * @param {string} cn cookie name
     * @type {string} cookie value
     */
	function getCookieByName (cn) {
		var k, i, c, ei;
		var cookies = document.cookie.split(";");
		for (i = 0; i < cookies.length; i++) {
            c = cookies[i];
            ei = c.indexOf("=");
			k = c.substr(0, ei).replace(/^\s+|\s+$/g, "");
			if (k === cn) {
                return decodeURIComponent(c.substr(ei + 1));
            }
		}
	}

	/**
     * Checks, whether passed value is Array (and not array-like object)
     * @param {*} value
     * @type {boolean}
     */
	function isArray (value) {
		return (Array.isArray && Array.isArray(value)) || (value instanceof Array);
	}

	/**
     * Checks, whether passed value is Undefined
     * @param {*} object
     * @type {boolean}
     */
	function isUndefined (object) {
		return typeof object === "undefined";
	}

	/**
     * Checks, whether value is object and empty,
     * i.e. JSON.serialize(value) == "{}";
     * @param {*} value
     * @type {boolean}
     */
    function isEmptyObject (value) {
        var property;
        if (typeof value !== 'object') { return true; }
        for (property in value) {
            if (value.hasOwnProperty(property)) {
                return false;
            }
        }
        return true;
    }
    
	/**
     * Checks, whether passed value is an empty array
     * @param {*} object
     * @type {boolean}
     */
    function isEmptyArray (value) {
        return this.isArray(value) && value.length === 0;
    }

	/**
     * Checks, whether passed value is a function
     * @param {*} object
     * @type {boolean}
     */
	function isFunction (object) {
        return typeof object === 'function';
	}

	/**
     * Checks, whether passed value is Numeric (Infinity excluded!)
     * @param {*} value
     * @type {boolean}
     */
	function isNumeric (value) {
		return !isNaN(parseFloat(value)) && isFinite(value);
	}

	/**
     * Checks, whether passed value is an Integer (Floats excluded)
     * @param {*} n
     * @type {boolean}
     */
	function isInt (n) {
		return isNumeric(n) && n === Math.floor(n);
	}

	/**
     * Checks, whether passed value is Boolean
     * @param {*} value
     * @type {boolean}
     */
	function isBool (value) {
		return typeof value === "boolean";
	}

	/**
     * Checks, whether passed value is String
     * @param {*} value
     * @type {boolean}
     */
	function isString (value) {
		return typeof value === "string";
	}

    /**
     * Checks, whether passed value is a piece of code (either as function or as string)
     * @param {*} value
     * @type {boolean}
     */
    function isCode (value) {
        return (typeof value === 'string') || (typeof value === 'function');
    }

    /**
     * Checks, whether passed value is Object
     * @param {*} value
     * @return {Boolean}
     */
    function isObject (value) {
        return Object.prototype.toString.call(value) === "[object Object]";
        //return (typeof value === 'object');
    }

	/**
     * Checks, whether passed value is proper dataDimension
     * @param {Dynamic} object
     * @type {Bool}
     */
	function isDataDimension (value) {
		return typeof value === 'string' && value.length !== 0;
	}

    /**
     * Gets document origin
     * @type {String} value
     */
    function getOrigin () {
        var L = document.location;
        return L.origin || L.protocol + '//' + L.host; // host is hostname + ?:port
    }

    /**
     * Callback-powered iterator, will apply callback function on all elements of iterator
     * callback may be passed in any place
     * @param {Array.<*>} iterator array or array-like object
     * @param {function(*, string, Array.<*>)} callback will get 3 params: value, key, iterator
     * @param {this:*} thisArg object, would be passed as this to callback
     * @return {*}
     */
    function each (iterator, callback, thisArg) {
        if (typeof iterator === 'undefined') { return false; }
        if ((iterator instanceof Array) ||  (iterator.length && (typeof iterator[0] !== 'undefined'))) {
            if (Array.prototype.forEach) {
                Array.prototype.forEach.call(iterator, callback, thisArg);
            } else {
                var i;
                var length = iterator.length;
                for (i = 0; i < length; i++) {
                    callback.call(thisArg, iterator[i], i, iterator);
                }
            }
        } else if (ElyTools.isUndefined(iterator.length) || typeof callback === 'function') {
            var name;
            for (name in iterator) {
                if (iterator.hasOwnProperty(name)) {
                    callback.call(thisArg, iterator[name], name, iterator);
                }
            }
        }
        return iterator;
    }

	/**
     * includes javascript file
     * @param {string} src path to the script
     * @param {function} callback called on script download completion
     * @param {function} onerror called on script loading error
     */
	function include (src, callback, onerror) {
        var root = document.getElementsByTagName("head")[0] || document.documentElement;
		var script = document.createElement("script");
		var done = false;
		script.onload = script.onreadystatechange = function () {
			if (done) { return; }
			if (this.readyState && this.readyState !== "loaded" && this.readyState !== "complete") { return; }
			done = true;
			// Handle memory leak in IE
			script.onload = script.onreadystatechange = null;
            if (root && script.parentNode) {
                root.removeChild(script);
            }
			if (callback) { callback(); }
		};
        if(onerror && onerror instanceof Function) {
            // ie7 and minor version browser of MS has bug with override onload/onerror
            script.onerror = onerror;
        }
		script.type = 'text/javascript';
		script.src = src + (window._elyCacheBuster || '');
        // prevent "operation aborted" in IE6
        if (!window.XMLHttpRequest) { script.defer = true; }
		root.insertBefore(script, root.firstChild);
	}

	/**
     * utility function, copies php one
     * @param {string} str
     * @type {string}
     */
	function ucfirst (str) {
		return str.replace(/^./, function (a) {
			return a.toLocaleUpperCase();
		});
	}

    /**
     * transform underscore_separated string into camelCased one
     * @param {string} str
     * @type {string}
     */
    function toCamelCase (str) {
        return str.replace(/_(\w)/g, function (a, l) { return l.toUpperCase(); });
    }

    /**
     * utility function, generate string of letters
     * @param {number} n length of the string
     * @type {string}
     */
    function randomStr (n) {
        var i = n, a = [];
        for (i; i >= 0; i--) { a.push(97 + Math.floor(Math.random() * 26)); }
        return String.fromCharCode.apply(null, a);
    }

    /**
     * gets generalized "input" value or null
     * @param {HTMLElement} input (input, select, button, textarea)
     * @type {?string|boolean|Array.<ElyTools.FormData>}
     */
    function serializeInput (input) {
        switch (input.type) {
        case 'checkbox':        return input.checked;
        case 'radio':           return input.checked ? input.value : null;
        case 'select-one':      return input.options[input.selectedIndex].text;
        case 'select-multiple': return ElyArray.map(ElyArray.filter(input.options, 'selected'), 'text');
        default: return ({ input: 1, select: 1, textarea: 1, button: 1 })[input.tagName.toLowerCase()] ? input.value : null;
        }
    }

    /**
     * seralizes form as and Forms element with "type" parameter
     * @param {HTMLFormElement|HTMLFieldSetElement} form or form-like element
     * @type {Array.<ElyTools.FormData>}
     */
    function serializeForm (form) {
        var out = [];
        var elements = form.elements || [];
        var i, l = elements.length, el, value;
        for (i=0; i<l; i++) {
            el = elements[i];
            value = serializeInput(el);
            if (value === null || value === undefined) { return; }
            out.push({ 'type': el.type, 'name': el.name, 'value': value });
        }
        return out;
    }

    /**
     * gets element's attribute value (false if no attr is set)
     * @param {jQuery} $el
     * @param {string} attr attribute name
     * @type {string|boolean}
     */
    function getAttr ($el, attr) {
        if (!$el || $el.length === 0) { return false; }
        return $el.eq(0).attr(attr);
    }

    /**
     * gets element's text
     * @param {jQuery} $el
     * @param {Object} conf config
     * @type {string}
     */
    function getTextValue ($el, conf) {
        if (!$el || $el.length === 0) { return false; }
        $el = $el.eq(0);
        return (conf && conf.valueFrom) ? $el.find(conf.valueFrom).text() : $el.text();
    }

    /**
     * gets element's inherent value
     * @param {jQuery} $el
     * @param {Object} conf config
     * @type {string}
     */
    function getNodeValue ($el, conf) {
        if (!$el || $el.length === 0) { return false; }
        $el = $el.eq(0);
        //var status = false;
        if (!conf || !conf.custom) {
            return $el.val();
        }
        switch (conf.custom.type) {
            case 'attribute':
                if (conf.custom.attribute && conf.custom.attribute.attrName && conf.custom.attribute.attrValue) {
                    var attr    = $el.attr(conf.custom.attribute.attrName),
                        aArray  = conf.custom.attribute.attrValue,
                        aLength = aArray.length;
                    if (aLength > 0) {
                        for (var i = 0; i < aLength; i++) {
                            if (aArray[i] === attr) {
                                var elAttr = $el.attr(conf.custom.attribute.checkAttr);
                                return conf.custom.attribute.convert ? !!elAttr : elAttr;
                            }
                        }
                    }
                }
                return $el.val();

            case 'text':
                return $el.text();

            default:
                return $el.val();
        }
    }

    if (!String.prototype.trim) { // IE8
        String.prototype.trim = function () {
            return this.replace(/^\s+|\s+$/g, "");
        };
    }

    Object.copy = function (obj, to) {
        if (typeof to === 'undefined') { to = {}; }
        var k;
        for (k in obj) {
            if (!obj.hasOwnProperty(k)) { continue; }
            to[k] = obj[k];
        }
        return to;
    };

    /**
     * @public
     * Mix mixinA, mixinB, mixinC ... to target
     * @param {Object} target
     * @param {Object} [mixin]
     */
    function mix (target) {
        var mixins = Array.prototype.slice.call(arguments, 1);
        for (var i = 0; i < mixins.length; ++i) {
            for (var prop in mixins[i]) {
                if (typeof target.prototype[prop] === "undefined") {
                    target.prototype[prop] = mixins[i][prop];
                }
            }
        }
    }

    /**
     * Convert value to specified value
     * @param value
     * @param type
     * @return {*}
     */
    function castTo (value, type) {
        var result,
            valueType;
        type = String(type).toLowerCase();

        switch (type) {
            case 'boolean':
                result = !!value;
                break;

            case 'number':
                result = Number(value);
                if (isNaN(result)) {
                    result = parseFloat(value) || 0;
                }
                break;

            case 'object':
                result = isObject(value) ? value : {}; // TODO [other] how to cast to Object?
                break;

            case 'array':
                result = isArray(value) ? value : [value] ;
                break;

            case 'string':
                valueType = typeof value;
                if (valueType === 'undefined' || value === null || value === false) { // TODO [other] think about it (is it true to convert undefined|null|false to empty string?)
                    result = '';
                } else {
                    result = String(value);
                }

                break;

            // unknown type
            default:
                result = String(value);
        }

        return result;
    }

    function generateSeed (n) {
        var i, _i, _ref, seedChunks;
        seedChunks = [];
        //TODO [optimization|cleanup] why so complex loop? looks like some vars are redundant
        for (i = _i = 1, _ref = n || 8; 1 <= _ref ? _i <= _ref : _i >= _ref; i = 1 <= _ref ? ++_i : --_i) {
            seedChunks.push(Math.floor(Math.random() * 36).toString(36));
        }
        return seedChunks.join('');
    }

// publishing functions
	return ({
		extend:         extend,
        clone:          clone,
		keys:           keys,
		isArray:        isArray,
		isUndefined:    isUndefined,
        isEmptyObject:  isEmptyObject,
        isEmptyArray:   isEmptyArray,
		isFunction:     isFunction,
		isInt:          isInt,
		isString:       isString,
		isBool:         isBool,
		isNumeric:      isNumeric,
		isCode:         isCode,
		isDataDimension: isDataDimension,
        isValue:        isDataDimension,
        isObject:       isObject,
		each:           each,
		include:        include,
		getCookieByName: getCookieByName,
		ucfirst:        ucfirst,
        toCamelCase:    toCamelCase,
        randomStr:      randomStr,
        serializeForm:  serializeForm,
        serializeInput: serializeInput,
        getOrigin:      getOrigin,
        getAttr:        getAttr,
        getTextValue:   getTextValue,
        getNodeValue:   getNodeValue,
        '$lambda': function $lambda(x) { return x; },
        mix: mix,
        castTo: castTo,
        generateSeed: generateSeed
	});
}());

/**
 * @class ElyTools.FormData
 */
/*@ if !live @*/
ElyTools.FormData = {
    /**
     * input type
     * @field
     * @type {string}
     */
    type: '',
    /**
     * input name
     * @field
     * @type {string}
     */
    name: '',
    /**
     * input value
     * boolean for checkboxes
     * object for multiple selects
     * @field
     * @type {string|boolean|Array.<string>}
     */
    value: false
};
/*@ fi @*/

(function (ElyTools) {

    var slice = Array.prototype.slice;

    /**
     *
     * @param fn
     * @param context
     * @return {*}
     */
    ElyTools.bind = function (fn, context) {
        if (arguments.length < 3 && ElyTools.isUndefined(context)) { // nothing to do, "context" is undefined
            return fn;
        }

        if (ElyTools.isFunction(fn.bind)) { // native support
            return fn.bind.apply(fn, slice.call(arguments, 1));
        }

        var __method = fn,
            args = slice.call(arguments, 2);

        return function () {
            return __method.apply(context, args.concat(slice.call(arguments)));
        };
    };

    /**
     * adds elements from 2nd array to 1st and returns it
     * @private
     * @param {Array} array
     * @param {Array} args
     * @type {Array} first arg
     */
    function update (array, args) {
        var arrayLength = array.length,
            length = args.length;
        while (length--) {
            array[arrayLength + length] = args[length];
        }
        return array;
    }

    /**
     * Returns names of arguments declared in function
     * @param {Function} fn
     * @return {Array}
     */
    ElyTools.argumentNames = function (fn) {
        var matched,
            names = [];

        if (this.isFunction(fn)) {
            matched = fn.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/);

            if (ElyTools.isArray(matched) && typeof matched[1] !== 'undefined') {
                names = matched[1].
                    replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '').
                    replace(/\s+/g, '').split(',');
            }
        }

        return names.length === 1 && !names[0] ? [] : names;
    };

    /**
     *
     * @param {Function} fn
     * @param {Function} wrapper
     * @return {Function}
     */
    ElyTools.wrap = function (fn, wrapper) {
        var __method = fn;
        return function () {
            var a = update([ElyTools.bind(__method, this)], arguments);
            return wrapper.apply(this, a);
        };
    };

})(ElyTools);


/**
 * @class ElyArray used for all those es5 array methods
 */

/**
 * @constructs
 */
function ElyArray () {
    ElyArray.prototype.push.apply(this, arguments);
}
ElyArray.prototype = [];
ElyArray.constructor = ElyArray;
/**
 * reduces an array to a single value
 * @param {Array.<InValue>} arr input array
 * @param {function(InValue, OutValue):OutValue} func
 * @param {OutValue} ?value
 * @type {OutValue}
 */
ElyArray.reduce = function (arr, func, value) {
    if (typeof arr.reduce === 'function') {
        return arr.reduce.apply(arr, [].slice.call(arguments, 1));
    }
    if (typeof func !== 'function') {
        throw new TypeError("\"" + func + "\" is not a function");
    }
    var len = arr.length;
    if (!len) {
        if (arguments.length > 2) { return value; }
        throw new TypeError("reduce of empty array with no initial value");
    }
    var i = 0;
    var val = value;
    if (arguments.length <= 2) { val = arr[i++]; } else { val = value; }
    for (i; i < len; i++) {
        if (!arr.hasOwnProperty(i)) { continue; }
        val = func(val, arr[i], i, arr);
    }
    return val;
};

/**
 * reduces an array to a single value (from tail)
 * if 3rd arg is not used, OutValue === InValue
 * @param {Array.<InValue>} arr input array
 * @param {function(OutValue,InValue):OutValue} func
 * @param {OutValue} ?value
 * @type {OutValue}
 */
ElyArray.reduceRight = function (arr, func, value) {
    if (typeof arr.reduceRight === 'function') {
        return arr.reduceRight.apply(arr, [].slice.call(arguments, 1));
    }
    if (typeof func !== 'function') {
        throw new TypeError("\"" + func + "\" is not a function");
    }
    var len = arr.length;
    if (!len) {
        if (arguments.length > 2) { return value; }
        throw new TypeError("reduce of empty array with no initial value");
    }
    var i = len - 1;
    var val;
    if (arguments.length <= 2) { val = arr[i--]; } else { val = value; }
    for (i; i >= 0; i--) {
        if (!arr.hasOwnProperty(i)) { continue; }
        val = func(val, arr[i], i, arr);
    }
    return val;
};

/**
 * filters out values from array (or array-like object)
 * @param {Array.<Value>} arr input array
 * @param {function(Value):boolean|string} callback or property name
 * @param {Object} thisArg
 * @type {Value}
 */
ElyArray.filter = function (arr, callback, thisArg) {
    if (typeof arr.filter === 'function' &&  typeof callback === 'function') {
        return arr.filter(callback, thisArg);
    }
    var prop;
    if (typeof callback === 'string') {
        prop = callback;
        callback = function (e) { return e[prop]; };
    }
    if (typeof callback !== 'function') {
        throw new TypeError("\"" + callback + "\" is not a function");
    }
    var len = arr.length;
    var out = [];
    var i;
    for (i = 0; i < len; i++) {
        if (Object.prototype.hasOwnProperty.call(arr, i) && callback.call(thisArg, arr[i])) {
            out.push(arr[i]);
        }
    }
    return out;
};

/**
 * maps array via callback function
 * @param {Array|string} arr main arg
 * @param {function(*):*|string} callback or property name
 * @param {Object} thisArg function call scope
 */
ElyArray.map = function (arr, callback, thisArg) {
    if (arr === null || arr === undefined) {
        throw new TypeError(" arr is null or not defined");
    }
    if (typeof arr.map === 'function' &&  typeof callback === 'function') {
        return arr.map(callback, thisArg);
    }
    // arr allows us to map strings
    var obj = Object(arr);
    var len = obj.length >>> 0;
    var prop;
    if (typeof callback === 'string') {
        prop = callback;
        callback = function (e) { return e[prop]; };
    }
    if (typeof callback !== 'function') {
        throw new TypeError(callback + " is not a function");
    }
    // setting length may significantly increase execution time
    var A = [];
    var k = 0;
    while (k < len) {
        if (obj.hasOwnProperty(k)) {
            A[k] = callback.call(thisArg, obj[k], k, obj);
        }
        k++;
    }
    return A;
};

/**
 * finds a record in array by partial match
 * @param {Array.<Value>} arr
 * @param {Object.<string,*>} obj
 * @type {Value}
 */
ElyArray.findBy = function (arr, obj) {
    var p, i = arr.length - 1;
    for (i; i >= 0; i--) {
        var elt = arr[i];
        var eq = true;
        for (p in obj) {
            if (!(p in elt)) { continue; }
            var f = obj[p],
                e = elt[p];
            eq = eq && (typeof f === 'function' ? f(e) : e === f);
        }
        if (eq) { return arr[i]; }
    }
};

/**
 * find the index of value in array
 */
ElyArray.inArray = function(arr,searchElement, fromIndex){
    for (var i = fromIndex||0, length = arr.length; i<length; i++) {
        if (arr[i] === searchElement) { return i; }
    }
    return -1;
};



(function (global) {

    var Ely = global.Ely;

    /**
     * classic-OOP class utility
     * @class ElyClass
     */
    var ElyClass = (function () {
        /**
         * flag, showing, whether dontEnum property is buggy
         * in current ecma implementation
         * @field
         * @type {boolean}
         * @private
         */
        var IS_DONTENUM_BUGGY = (function () {
            var p;
            for (p in { toString: 1 }) {
                if (p === 'toString') { return false; }
            }
            return true;
        }());

        function Subclass () {}

        /**
         * creates a class
         * arguments are fetched dynamically
         * @type {ElyClass}
         */
        function create () {
            var parent = null, properties = [].slice.call(arguments);
            if (typeof properties[0] === 'function') {
                parent = properties.shift();
            }

            var klass = function () {
                return this.init.apply(this, arguments);
            };

            ElyTools.extend(klass, ElyClass.Methods);
            klass.superclass = parent;
            klass.subclasses = [];

            if (parent) {
                Subclass.prototype = parent.prototype;
                klass.prototype = new Subclass();
                parent.subclasses.push(klass);
            }

            var i, length = properties.length;
            for (i = 0; i < length; i++) {
                klass.addMethods(properties[i]);
            }

            if (!klass.prototype.init) {
                klass.prototype.init = function () {};
            }


            klass.prototype.constructor = klass;
            return klass;
        }

        /**
         * adds methods to the class
         * @param {Object.<Function>} source
         * @type {ElyClass}
         */
        function addMethods (source) {
            var ancestor = this.superclass && this.superclass.prototype,
                properties = ElyTools.keys(source);
            if (IS_DONTENUM_BUGGY) {
                if (source.toString !== Object.prototype.toString) { properties.push("toString"); }
                if (source.valueOf !== Object.prototype.valueOf) { properties.push("valueOf"); }
            }

            var i, length = properties.length;
            for (i = 0; i < length; i++) {
                var property = properties[i], value = source[property];
                if (ancestor && typeof value === 'function' && (ElyTools.argumentNames(value)[0] === "$super")) {
                    var method = value;
                    value = ElyTools.wrap(methodCreator(property, ancestor), method);

                    value.valueOf = ElyTools.bind(method.valueOf, method);
                    value.toString = ElyTools.bind(method.toString, method);
                }
                this.prototype[property] = value;
            }

            function methodCreator (m, ancestor) {
                return function () {
                    return ancestor[m].apply(this, arguments);
                };
            }

            return this;
        }

        return ({
            create: create,
            Methods: {
                addMethods: addMethods
            },
            getAllPrototypes: function (inst) {
                var a = [], cl = inst.constructor;
                for (cl; cl; cl = cl.superclass) {
                    a.push(cl.prototype);
                }
                return a;
            }
        });
    }());

    // Ely.namespace(global, 'Ely.Class', ElyClass);

    global.ElyClass = ElyClass; // TODO [best practices]: backward compatibility, remove globar var in future

})(this);

},{}],3:[function(require,module,exports){
(function (process){

    var iql = require('./ElyProfile.js');

    $(document).ready(function(){
        window.startProfile(iql);
    });

// data = require(process.argv[3] ? './' + process.argv[3] : './profile');

// iql.loadData(data.profile);

// console.log(process.argv[2] ? eval("iql." + process.argv[2]) : iql.collectApp("web").section("wsc1").event("search").eventData("search-string").starts("samsung").eventFrequency(2));

}).call(this,require("lppjwH"))
},{"./ElyProfile.js":1,"lppjwH":4}],4:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}]},{},[3])