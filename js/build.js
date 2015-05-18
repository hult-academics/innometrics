var recordsShown = 5,
 scopeInterval = 29, //time interval in days to be displayed (starts at 0, so currently its 30 days)
 timeUnitSwitch = 2 * 60, // threshold of maximum session time (ms) at which point the chart is rendered in minutes
 paginationUnit = 5,
 timeUnitLegend = {
	seconds: 'secs',
	 minutes: 'mins'
}


//var testPID = "";
//var testPID = "alexavs87@hotmail.com";
//var testPID = "geoff.williams@hult.edu";
var testPID = "lashabhi503@gmail.com";

window.timealign = function(){
	var now = new Date();
	now.setHours(23);
	now.setMinutes(59);
	now.setSeconds(59);
	return parseInt(now/1000 + 1,10);
}

// get PID
// get Profile from PID
window.startProfile = function(iql){
	window.iql = iql;
	var pid = getPID() ? getPID() : testPID; //return this to empty string
	if(pid){
		getProfile(pid);
	}
	$('#refresh').click(function(){
		window.location.reload();
	});
	$('#showall').click(function(){
		$("tr.hidden").show().toggleClass('hidden');
		$('.js-more').text('Collapse records').attr('data-action', 'collapse');
	});
}

//get PID from url query string
window.getPID = function(){
	var m = RegExp('[?&]pid=([^&]*)','i').exec(window.location.search);
	return m && decodeURIComponent(m[1].replace(/\+/g, ' '));
}
//
//getProfile
// should account for error
window.getProfile = function(pid){
	$.ajax({
		url: "https://api.innomdc.com/v1/companies/149/buckets/hult/profiles/"+pid+"/?method=POST&type=jsonp&callback=receive&data={%22id%22:%22"+pid+"%22}",
		dataType: "jsonp"
	});
}

window.receive = function (data){
	iql.loadData(data.profile);
	var dataset = populateLineChartDataSet(scopeInterval);
	generateVistedPages("web","page-view",scopeInterval);
	generateRecentActivity("web","page-view",scopeInterval);
	generateDataChart(dataset);
}

generateVistedPages = function(channel,ev, days){
	var end = timealign() * 1000;
	var start = end - 2419200000;
	var counters = {}, titles = {}, buffer = [], hc = "", ts = {};

	var events = iql.collectApp(channel).section("hult-edu").event(ev).inLast("events.day",days).getEvents();
	for(var i = 0; i < events.length; i ++){
		if(!counters[events[i].data.url]){
			counters[events[i].data.url] = "1";
			titles[events[i].data.url] = events[i].data.title;
			ts[events[i].data.url] = new Date(events[i].createdAt);
		} else {
			counters[events[i].data.url] = (parseInt(counters[events[i].data.url], 10) + 1).toString();
			ts[events[i].data.url] = new Date(events[i].createdAt);
		}
	}
	for(a in counters){
		buffer.push([a,counters[a]]);
	}
	buffer.sort(function(a,b){return b[1] - a[1]});
	for(element in buffer){
		hidden = ''
		if(element > recordsShown - 1){
			hidden = 'hidden';
		}

		hc += '<tr class='+ hidden +'>' +
			    '<td class="tg-lf6h">'+buffer[element][1]+'</td>' +
				'<td class="tg-lf6h">'+moment(ts[buffer[element][0]]).format("MM/DD/YYYY")+'</td>' +
				'<td class="tg-lf6h">'+titles[buffer[element][0]]+'</td>' +
				//'<td class="tg-lf6h">'+channel+'</td>' +
				'<td class="tg-gjl5">' +
					'<a href="http:'+ buffer[element][0] +'">'+ cleanURL(buffer[element][0]) +'</a>' +
				'</td>' +
		      '</tr>';
	}

	var $mostVisited = $("#most-visited");

	$mostVisited.append(hc);

	if($('.hidden ',$mostVisited).length > 0){
		$mostVisited.after( '<a href="#" class="js-more" data-action="expand">View <span>'+ paginationUnit +'</span> more records</a>');
	}

	return true;
}


var cleanURL = function(myURL){

	//remove url parameters
	myURL = myURL.split("?")[0];

	myURL = myURL.toString().substr(2, myURL.length);

	return myURL
}

generateRecentActivity = function(channel,ev,days){
	var end = timealign() * 1000;
	var start = end - 2419200000;
	var hc = "";
	var events = iql.collectApp(channel).section("hult-edu").event(ev).inLast("events.day",days).getEvents();

	for (var i = 1; i < events.length + 1; i ++ ){
		hidden = ''

		if(i > recordsShown){
			hidden = 'hidden';
		}

		var myURL = events[events.length - i].data.url;
		var myCleanURL = (events[events.length - i].data.url).substr(2, myURL.toString().length);

		hc += '<tr class='+ hidden +'>' +
				'<td class="tg-lf6h">'+channel+'</td>' +
				'<td class="tg-lf6h">'+ev+'</td>' +
			    '<td class="tg-lf6h">'+moment(events[events.length - i].createdAt).format("MM/DD/YYYY")+'</td>' +
				'<td class="tg-lf6h">'+events[events.length - i].data.title+'</td>' +
				'<td class="tg-gjl5">' +
					'<a href="http:'+ events[events.length - i].data.url +'">'+ cleanURL(events[events.length - i].data.url) +'</a>' +
				'</td>' +
			  '</tr>';
	}

	var $recentEngagement = $("#recent-engagement");

	$recentEngagement.append(hc);

	if($('.hidden ', $recentEngagement.length > 0)){
		if($recentEngagement.length > paginationUnit){
			//has more than X
		}else{
			//has less than X
		}
		$recentEngagement.after( '<a href="#" class="js-more" data-action="expand">View <span>'+ paginationUnit +'</span> more records</a>');
	}

	return true;
}


populateLineChartDataSet = function(recent){
	var end = timealign() * 1000;
	var start = end - (scopeInterval *24*60*60*1000); //ms
	var day = new Date(), temp = [], dataset = {};

	for(var d = recent; d >= 0; d --){
		day = window.moment().subtract(d, 'days')._d; //moment.js api
		temp[0] = new Date(day).getMonth() + 1;
		temp[1] = new Date(day).getDate();
		dataset[temp.join("/")] = 0;
		temp = [];
	}

	var s = iql.collectApp("web").section("hult-edu").sessions;
	for(var i = 0, index = 0; i < s.length; i ++){
		if(s[i].createdAt > start && s[i].createdAt < end){
			temp[0] = new Date(s[i].createdAt).getMonth() + 1;
			temp[1] = new Date(s[i].createdAt).getDate();

			dataset[temp.join("/")] += (((s[i].data["visit-duration"] && s[i].data["visit-duration"] > 0) ? s[i].data["visit-duration"] : 0)); //0 sec for empty sessions which could be a bounce or email activity
			//dataset[temp.join("/")] += (s[i].modifiedAt - s[i].createdAt)/60000;
			temp = [];
		}
	}
	return dataset;
}




//assess if the chart will render in seconds or minutes
// if minute, convert values
var setChartTimeUnit = function(sessionTimes){
	//sessionTime
	var peakTime = 0;

	sessionTimes.forEach(function(sessionTime){

		(peakTime < sessionTime) ? (peakTime = sessionTime):peakTime;

	})

	if(peakTime > timeUnitSwitch){
		//display chart in minutes
		for (i = 0; i < sessionTimes.length; i++) {
			sessionTimes[i] = (Math.round(sessionTimes[i]/60*100)/100); //maybe calculate seconds instead of rounding
		}

		$('.chartFrame').prepend('<span class="yUnit">'+ timeUnitLegend.minutes +'</span>');
	}else{
		//display chart in seconds
		$('.chartFrame').prepend('<span class="yUnit">'+ timeUnitLegend.seconds +'</span>');
	}

	return sessionTimes
}

generateDataChart = function(dataset){
	var x = [], d = [];
	var ctx = document.getElementById("timeonvisit").getContext("2d");
	$.each(dataset, function(k,v){
		x.push(k);
		d.push(v);
	});

	d = setChartTimeUnit(d);

	var chartdata = {
		labels: x,
		datasets: [
			{
				label: "Recent " + scopeInterval + " days Visit Duration",
				fillColor: "rgba(41,196,219,0.2)",
				strokeColor: "rgba(41,196,219,1)",
				pointColor: "#fff",
				pointStrokeColor: "rgba(41,196,219,1)",
				pointHighlightFill: "#fff",
				pointHighlightStroke: "rgba(41,196,219,1)",
				data: d
			}
		]
	};
	var options = {

		tooltipFillColor: "rgba(0,0,0,0.4)",

		///Boolean - Whether grid lines are shown across the chart
		scaleShowGridLines : true,

		//String - Colour of the grid lines
		scaleGridLineColor : "rgba(0,0,0,.05)",

		//Number - Width of the grid lines
		scaleGridLineWidth : 1,

		//Boolean - Whether to show horizontal lines (except X axis)
		scaleShowHorizontalLines: true,

		//Boolean - Whether to show vertical lines (except Y axis)
		scaleShowVerticalLines: true,

		scaleFontColor: "#000",

		//Boolean - Whether the line is curved between points
		bezierCurve : false,

		//Number - Tension of the bezier curve between points
		//bezierCurveTension : 0.4,

		//Boolean - Whether to show a dot for each point
		pointDot : true,

		//Number - Radius of each point dot in pixels
		pointDotRadius : 6,

		//Number - Pixel width of point dot stroke
		pointDotStrokeWidth : 3,

		//Number - amount extra to add to the radius to cater for hit detection outside the drawn point
		pointHitDetectionRadius : 20,

		//Boolean - Whether to show a stroke for datasets
		datasetStroke : true,

		//Number - Pixel width of dataset stroke
		datasetStrokeWidth : 3,

		//Boolean - Whether to fill the dataset with a colour
		datasetFill : true,

		responsive : true,

		//String - A legend template
		legendTemplate : "<ul class=\"<%=name.toLowerCase()%>-legend\"><% for (var i=0; i<datasets.length; i++){%><li><span style=\"background-color:<%=datasets[i].strokeColor%>\"></span><%if(datasets[i].label){%><%=datasets[i].label%><%}%></li><%}%></ul>"

	};
	var timeonvisit = new Chart(ctx).Line(chartdata, options);
	return true;
}

$(document).on('click', '.js-more', function(e){
	e.preventDefault();
	e.stopPropagation();

	var myAction=$(e.target).attr('data-action');
	var $thisTable = $(e.target).prev('table');

	if(myAction == "expand"){
		var $toHide = $thisTable.find('.hidden').slice(0, (paginationUnit - 1));

		$toHide.each(function(){
			$(this).show().toggleClass('hidden');
		});

		if($thisTable.find('.hidden').length <= 0){
			$(e.target).text('Collapse records').attr('data-action', 'collapse');
		}
	}else{
		//action == contract
		var $myRows = $thisTable.find('tbody > tr')
		$myRows.slice(recordsShown, $myRows.length).each(function(){
			$(this).hide().toggleClass('hidden');
			$(e.target).text('View '+ paginationUnit +' more records').attr('data-action', 'expand');
		})
	}


})