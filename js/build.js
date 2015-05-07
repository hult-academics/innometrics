var recordsShown = 5;

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
	var pid = getPID() ? getPID() : "geoff.williams@hult.edu"; //return this to empty string
	if(pid){
		getProfile(pid);
	}
	$('#refresh').click(function(){
		window.location.reload();
	});
	$('#showall').click(function(){
		$("tr:hidden").show();
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
	var dataset = populateLineChartDataSet(28);
	generateVistedPages("web","page-view",28);
	generateRecentActivity("web","page-view",28);
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
			hidden = 'style="display:none;"';
		}

		hc += '<tr '+ hidden +'>' +
			    '<td class="tg-lf6h">'+buffer[element][1]+'</td>' +
				'<td class="tg-lf6h">'+moment(ts[buffer[element][0]]).format("MM/DD/YYYY")+'</td>' +
				'<td class="tg-lf6h">'+titles[buffer[element][0]]+'</td>' +
				//'<td class="tg-lf6h">'+channel+'</td>' +
				'<td class="tg-gjl5">'+buffer[element][0]+'</td>' +
		      '</tr>';
	}
	$("#most-visited").append(hc);
	return true;
}

generateRecentActivity = function(channel,ev,days){
	var end = timealign() * 1000;
	var start = end - 2419200000;
	var hc = "";
	var events = iql.collectApp(channel).section("hult-edu").event(ev).inLast("events.day",days).getEvents();

	for (var i = 1; i < events.length + 1; i ++ ){
		hidden = ''

		if(i > recordsShown){
			hidden = 'style="display:none;"';
		}

		hc += '<tr '+ hidden +'>' +
				'<td class="tg-lf6h">'+channel+'</td>' +
				'<td class="tg-lf6h">'+ev+'</td>' +
			    '<td class="tg-lf6h">'+moment(events[events.length - i].createdAt).format("MM/DD/YYYY")+'</td>' +
				'<td class="tg-lf6h">'+events[events.length - i].data.title+'</td>' +
				'<td class="tg-gjl5">'+events[events.length - i].data.url+'</td>' +
			  '</tr>';
	}

	$("#recent-engagement").append(hc);
	return true;
}

populateLineChartDataSet = function(recent){
	var end = timealign() * 1000;
	var start = end - 2419200000; //ms
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

			dataset[temp.join("/")] += (((s[i].data["visit-duration"] && s[i].data["visit-duration"] > 0) ? s[i].data["visit-duration"] : 30)/60); //30 sec for empty sessions which could be a bounce or email activity
			//dataset[temp.join("/")] += (s[i].modifiedAt - s[i].createdAt)/60000;
			temp = [];
		}
	}
	return dataset;
}


generateDataChart = function(dataset){
	var x = [], d = [];
	var ctx = document.getElementById("timeonvisit").getContext("2d");
	$.each(dataset, function(k,v){
		x.push(k);

		var y = moment.duration(v, 'milliseconds')
		d.push(y.seconds());
	});

	console.log(d);

	var chartdata = {
		labels: x,
		datasets: [
			{
				label: "Recent 28 days Visit Duration",
				fillColor: "rgba(41,196,219,0.2)",
				strokeColor: "rgba(41,196,219,1)",
				pointColor: "rgba(41,196,219,1)",
				pointStrokeColor: "#fff",
				pointHighlightFill: "#fff",
				pointHighlightStroke: "rgba(41,196,219,1)",
				backgroundColor: "#F8F8F8",
				data: d
			}
		]
	};
	var options = {

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

		//Boolean - Whether the line is curved between points
		bezierCurve : false,

		//Number - Tension of the bezier curve between points
		bezierCurveTension : 0.4,

		//Boolean - Whether to show a dot for each point
		pointDot : true,

		//Number - Radius of each point dot in pixels
		pointDotRadius : 3,

		//Number - Pixel width of point dot stroke
		pointDotStrokeWidth : 1,

		//Number - amount extra to add to the radius to cater for hit detection outside the drawn point
		pointHitDetectionRadius : 20,

		//Boolean - Whether to show a stroke for datasets
		datasetStroke : true,

		//Number - Pixel width of dataset stroke
		datasetStrokeWidth : 2,

		//Boolean - Whether to fill the dataset with a colour
		datasetFill : true,

		//String - A legend template
		legendTemplate : "<ul class=\"<%=name.toLowerCase()%>-legend\"><% for (var i=0; i<datasets.length; i++){%><li><span style=\"background-color:<%=datasets[i].strokeColor%>\"></span><%if(datasets[i].label){%><%=datasets[i].label%><%}%></li><%}%></ul>"

	};
	var timeonvisit = new Chart(ctx).Line(chartdata, options);
	return true;
}