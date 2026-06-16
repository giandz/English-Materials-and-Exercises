var pageurl = new URL(window.location);

var jsurl = pageurl.searchParams.get("lang").toLowerCase() + "_" + pageurl.searchParams.get("course").toLowerCase() + "_" + pageurl.searchParams.get("level").toLowerCase() + "_" + pageurl.searchParams.get("class") + ".js"

//var jsurl = pageurl.searchParams.get("class") + ".js"


//"sampleclass.js";
var jstag = document.createElement("script");
jstag.src = jsurl;
document.head.append(jstag);
//fetch('./data.json').then(response => {return response.json()}).then(data => {the_class = data}).catch(err => {alert("Class doesn't exist yet :')")});
if (pageurl.searchParams.get("teacher") == "true") {
	var teacherMode = true;
}
