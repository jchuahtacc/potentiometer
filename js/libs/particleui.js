particleui = { };

particleui._particle = new Particle();

particleui._token = null;

particleui._deviceId = null;

particleui.devices = { };

particleui._events = null;

/**
 * Select the default deviceId for widgets that have no particleui-deviceid attribute
 * @param {String} deviceId     deviceId to set
 * @return null
 */
particleui.selectDeviceId = function(deviceId) {
    particleui._deviceId = deviceId;
    var that = this;
    if (particleui._deviceId != null) {
        particleui.getDevice(deviceId).then(
            function(result) {
                particleui.refresh(".particleui");
            },
            function(error) {
                particleui.refresh(".particleui");
            }
        );
    } else {
    }
};

particleui.getDevice = function(deviceId) {
    var params = { };
    var dev = null;
    if (deviceId) {
        dev = deviceId;
    } else if (this._deviceId) {
        dev = this._deviceId;
    }
    params.deviceId = dev;
    params.auth = this._token;
    var that = this;
    var promise = new Promise(function(resolve, reject) {
        that._particle.getDevice(params).then(
            function(result) {
                if (dev) {
                    that.devices[dev] = result.body;
                }
                resolve(result);
            },
            function(error) {
                if (dev) {
                    that.devices[deviceId] = null;
                }
                reject(error);
            }
        );
    });
    return promise;
};

/**
 * Return an event stream promise using current authorization token 
 * @param {String} name         Event name to request from the event stream
 * @param {String} deviceId     Device ID to request from the event stream
 * @return {Promise}
 */
particleui.getEventStream = function(name = null, deviceId = null) {
    var params = { };
    if (name && name.length) {
        params.name = name;
    }
    if (deviceId && deviceId.length) {
        params.deviceId = deviceId;
    }
    params.auth = particle._token;
    return this._particle.getEventStream(params); 
};

/**
 * Login to Particle.io cloud. On success, particleui will save the returned authorization token 
 * and begin monitoring device status for automatic widget updating
 *
 * @param {String} email        Email address to login with 
 * @param {String} password     Password to login with
 * @return {Promise}
 */
particleui.login = function(email, password) {
    var that = this;
    var promise = new Promise(function(resolve, reject) {
        that._particle.login({ username : email, password : password }).then(
            function(data) {
                that._token = data.body.access_token;
                that._particle.getEventStream({ deviceId: 'mine', auth: that._token }).then(
                    function(stream) {
                        if (that._events) {
                            that._events.end();
                            that._events = null;
                        }
                        that._events = stream;
                        that._events.on('event', function(result) {
                            if (result.name === "spark/status") {
                                if (result.data === "online") {
                                    that.getDevice(result.coreid).then(
                                        function(result) {
                                            that.refresh(".particleui");
                                        },
                                        function(error) {
                                            that.refresh(".particleui");
                                        }
                                    );
                                }
                                if (result.data === "offline") {
                                    if (that.devices[result.coreid]) {
                                        that.devices[result.coreid].connected = false;
                                        that.refresh(".particleui");
                                    }
                                }
                            }
                        });
                    }
                );
                that._particle.listDevices({ auth: that._token }).then(
                    function(result) {
                        for (key in result.body) {
                            //that.devices[result.body[key].id] = result.body[key];
                            that.getDevice(result.body[key].id);
                        }
                        if (result.body.length == 1) {
                            that.selectDeviceId(result.body[0].id);
                        }
                    },
                    function(error) {
                    }
                );
                resolve(data);
            },
            function(error) {
                reject(error);
            }
        );
    });
    return promise;
};

/**
 * Logout of the Particle.io cloud, clear default device ID, authorization token, and stop
 * updating widgets.
 *
 * @return {Promise}
 */
particleui.logout = function() {
    this._token = null;
    this._deviceId = null;
    this.devices = { };
    if (this._events) {
        this._events.end();
        this._events = null;
    }
}

/**
 * List devices on the currently signed in Particle.io account
 *
 * @return {Promise}
 */
particleui.listDevices = function() {
    return this._particle.listDevices({ auth: this._token });
};

/**
 * Get a device variable using the current Particle.io authorization token
 *
 * @param {String} variable      Variable name
 * @param {String} deviceId      Optional device ID. If no ID is specified, then the default ID will be used
 * @return {Promise}
 */
particleui.getVariable = function(variable, deviceId = null) {
    var params = { };
    params.auth = this._token;
    params.name = variable;
    if (deviceId && deviceId.length) {
        params.deviceId = deviceId;
    } else {
        params.deviceId = this._deviceId;
    }
    return this._particle.getVariable(params);
};

/**
 * Call a device function
 *
 * @param {String} name          Function name 
 * @param {String} argument      Function argument string
 * @param {String} deviceId      Optional device ID. If no ID is specified, then the default ID will be used
 * @return {Promise}
 */
particleui.callFunction = function(name, argument = null, deviceId = null) {
    var params = { };
    params.name = name;
    params.auth = this._token;
    if (deviceId && deviceId.length) {
        params.deviceId = deviceId;
    } else {
        params.deviceId = this._deviceId;
    }
    if (argument && argument.length) {
        params.argument = argument;
    }
    return this._particle.callFunction(params);
};

/**
 * Publish an event
 *
 * @param {String} name         Event name
 * @param {String} data         Event data
 * @param {bool} isPrivate      Public or private event. (Defaults to true)
 * @return {Promise}
 */
particleui.publishEvent = function(name, data = null, isPrivate = true) {
    var params = { };
    params.name = name;
    if (data) {
        params.data = data;
    }
    params.auth = this._token;
    params.isPrivate = isPrivate;
    return this._particle.publishEvent(params);
};

particleui._fillText = function(element, text) {
    var $that = $(element);
    if ($that.is("input") || $that.is("textarea")) {
        $that.val(text);
    } else {
        $that.html(text);
    }
}

particleui._enable = function(element) {
    var promise = new Promise(function(resolve, reject) {
        var $that = $(element);
        var deviceId = $(element).attr('particleui-deviceid');
        var name = $(element).attr('particleui-name');
        if (!deviceId || !deviceId.length) {
            deviceId = particleui._deviceid;
        }
        if ($that.hasClass("particleui-variable")) {
            particleui.getVariable(name, deviceId).then(
                function(result) {
                    if (result.body.result) {
                        particleui._fillText($that, result.body.result); 
                    } else {
                        particleui._fillText($that, "---");
                    }
                    resolve(null);
                },
                function(error) {
                    particleui._fillText($that, "---");
                    resolve(null);
                }
            );
        } else if ($that.hasClass("particleui-device")) {
            $that.attr('disabled', false)
            resolve(null);
        } else if ($that.hasClass("particleui-function")) {
            $that.attr('disabled', false);
            resolve(null)
        } else if ($that.hasClass("particleui-publish")) {
            $that.attr('disabled', false);
            resolve(null)
        }
    });
    return promise;
}

particleui._disable = function(element) {
    var $that = $(element);
    if ($that.hasClass("particleui-variable")) {
        $that.attr('disabled', 'disabled');
        particleui._fillText($that, "---");
    } else if ($that.hasClass("particleui-device")) {
        $that.attr('disabled', 'disabled');
    } else if ($that.hasClass("particleui-function")) {
        $that.attr('disabled', 'disabled');
    } else if ($that.hasClass("particleui-publish")) {
        $that.attr('disabled', 'disabled');
    }
}

/**
 * Refresh partcleui widgets. Only particleui widgets will be refreshed, based on
 * device connection status
 *
 * @param {String} selector     A DOM selector of elements to refresh
 */
particleui.refresh = function(selector) {
    var promise = new Promise(function(resolve, reject) {
        if (selector) {
            $selector = $(selector);
            var count = $selector.length;
            var decrementCounter = function() {
                count--;
                if (count <= 0) {
                    resolve(null);
                }
            }
            $selector.each(function() {
                var name = $(this).attr('particleui-name');
                var deviceId = $(this).attr('particleui-deviceid');
                if (!deviceId || !deviceId.length) {
                    deviceId = null;
                }
                if (name && name.length) {
                    var $that = $(this);
                    if (deviceId) {
                        if (particleui.devices[deviceId] && particleui.devices[deviceId].connected) {
                            particleui._enable($that).then(function(result) { decrementCounter() });
                        } else {
                            particleui._disable($that);
                            decrementCounter();
                        }
                    } else {
                        if ($that.hasClass("particleui-publish")) {
                            particleui._enable($that).then(function(result) { decrementCounter() });
                        } else {
                            if (particleui._deviceId && particleui.devices[particleui._deviceId] && particleui.devices[particleui._deviceId].connected) {
                                particleui._enable($that).then(function(result) { decrementCounter() });
                            } else {
                                particleui._disable($that);
                                decrementCounter();
                            }
                        }
                    }
                }
            });
        }
    });
    return promise;
};

particleui._click = function(element) {
    var $element = $(element);
    $element.click(function(ev) {
        var data = $(element).attr('particleui-data');
        var name = $(element).attr('particleui-name');
        var isPrivate = $(element).attr('particleui-isprivate');
        var deviceId = $(element).attr('particleui-deviceid');
        if (isPrivate && isPrivate.length) {
            isPrivate = isPrivate !== "false";
        }
        if ($element.hasClass("particleui-function")) {
            particleui.callFunction(name, data, deviceId);
        } else if ($element.hasClass("particleui-publish")) {
            particleui.publishEvent(name, data, isPrivate);
        } else if ($element.hasClass("particleui-device")) {
            particleui.selectDeviceId(deviceId);
        }
    });
};

(function( $ ) {
    $.fn.particleui = function() {
        return this.each(function() {
            if ($(this).hasClass("particleui-function")) {
                particleui._click(this);
            }
            if ($(this).hasClass("particleui-publish")) {
                particleui._click(this);
            }
            if ($(this).hasClass("particleui-device")) {
                particleui._click(this);
            }
        });
    };
}(jQuery));

$(document).ready(function() {
    $(".particleui").particleui();
});
