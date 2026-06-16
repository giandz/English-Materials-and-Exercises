var pageurl = new URL(window.location);

//~var jsurl = "https://airspeak.academy/materials/" + pageurl.searchParams.get("lang").toLowerCase() + "/" + pageurl.searchParams.get("course").toLowerCase() + "/" + pageurl.searchParams.get("level").toLowerCase() + "/class" + pageurl.searchParams.get("class") + ".js"

var jsurl = pageurl.searchParams.get("class") + ".js"


//"sampleclass.js";
var jstag = document.createElement("script");
jstag.src = jsurl;
document.head.append(jstag);
//fetch('./data.json').then(response => {return response.json()}).then(data => {the_class = data}).catch(err => {alert("Class doesn't exist yet :')")});
if (pageurl.searchParams.get("teacher") == "true") {
	var teacherMode = true;
}
