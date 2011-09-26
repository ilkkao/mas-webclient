
qx.Class.define("client.Settings",
{
    extend : qx.core.Object,

    construct : function(srpc, params)
    {
	this.rpc = srpc;
	this.update(params);
    },

    //TODO: write proper destructor

    properties :
    {
	firstTime : { init : 1, apply : "_applyFirstTime" },
	loggingEnabled : { init : 1, apply : "_applyLoggingEnabled" },
	sslEnabled : { init : 0, apply : "_applySslEnabled" },
	largeFonts : { init : 1, apply : "_applyLargeFonts" },
	autoArrange : { init : 1, apply : "_applyAutoArrange" },
	showCloseWarn : { init : 1, apply : "_applyShowCloseWarn" }
    },

    members :
    {
	rpc : 0,
	initdone : 0,

	update : function(params)
	{
	    this.initdone = 0;
	    
	    var allsettings = params.split("||");
	    
	    for (var i=0; i < allsettings.length; i = i + 2)
	    {
		var key = allsettings[i];
		var value = allsettings[i+1];
		
		switch(key)
		{
		case "firstTime":
		    this.setFirstTime(value);
		    break;

		case "autoArrange":
		    this.setAutoArrange(value);
		    break;

		case "largeFonts":
		    this.setLargeFonts(value);
		    break;
		    
		case "loggingEnabled":
		    this.setLoggingEnabled(value);
		    break;
		    
		case "sslEnabled":
		    this.setSslEnabled(value);
		    break;

		case "showCloseWarn":
		    this.setShowCloseWarn(value);
		    break;
		}
	    }
	    this.initdone = 1;
	},

	_applyShowCloseWarn : function(value) 
	{
	    this.send("showCloseWarn", value);
	},

	_applyFirstTime : function(value) 
	{
	    this.send("firstTime", value);
	},

	_applyLoggingEnabled : function(value)
	{
	    this.send("loggingEnabled", value);
	},

	_applySslEnabled : function(value)
	{
	    this.send("sslEnabled", value);
	},

	_applyLargeFonts : function(value)
	{
	    this.send("largeFonts", value);
	},

	_applyAutoArrange : function(value)
	{
	    this.send("autoArrange", value);
	},

	send : function(name, value)
	{
	    if (this.initdone == 1)
	    {
		this.rpc.call("SET", name + " " + value);
	    }
	}
    }
});
