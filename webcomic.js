<html>

<head>
    <link href="https://fonts.googleapis.com/css?family=Comfortaa" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css?family=Nunito" rel="stylesheet">
    <!-- <script src="https://www.youtube.com/player_api"></script> -->
    <link rel="stylesheet" href="lesson.css">
    <!-- <script type="text/javascript" src="sampleclass.js"></script> -->
    <link rel="stylesheet" href="builder.css">
    <link rel="stylesheet" href="visual.css">

    <meta charset="UTF-8">
</head>

<body>
    <div id="builder-controls">
    </div>
    <div id="builder-preview">
        <button id="builder-toggle" onclick="toggleFullPrev(this)">📺</button>
        <div class="preview sheet">
            <img id="lesson-header" src="header.png" />
            <img id="lesson-logo" src="asa-header-logo.png" />
            <img id="lesson-flag" />
            <span id="lesson-lang"></span>
            <img id="wordmark" src="asa-logo-text.png" />
            <img id="hex" src="asa-hex-a1-empty.png" />
            <span id="lesson-type"></span>
            <span id="lesson-subtype"></span>
            <div id="lesson-content"></div>
            <img id="lesson-footer" src="footer.png" />
            <img id="footer-web" src="footer-web.png" />
            <img id="footer-soc" src="footer-soc.png" />
        </div>
    </div>

</body>
<datalist id="language">
    <option value="en">English</option>
    <option value="es">Español</option>
    <option value="fr">Français</option>
    <option value="pt">Português</option>
    <option value="de">Deutsch</option>
    <option value="it">Italiano</option>
</datalist>
<datalist id="course">
    <option value="ESL">ESL</option>
    <option value="ESP">ESP</option>
    <option value="ELE">ELE</option>
</datalist>
<datalist id="level">
    <option value="A1">A1</option>
    <option value="A2">A2</option>
    <option value="B1">B1</option>
    <option value="B2">B2</option>
    <option value="C1">C1</option>
    <option value="C2">C2</option>
    <option value="FF">FF</option>
</datalist>
<datalist id="class-type">
    <option value="Systems">Systems</option>
    <option value="Skills">Skills</option>
    <option value="Freestyle">Freestyle</option>
</datalist>
<datalist id="class-subtype">
    <option value="Grammar">Grammar</option>
    <option value="Vocabulary">Vocabulary</option>
    <option value="Functions">Functions</option>
    <option value="Phonology">Phonology</option>
    <option value="Reading-Speaking">Reading-Speaking</option>
    <option value="Reading-Writing">Reading-Writing</option>
    <option value="Listening-Speaking">Listening-Speaking</option>
    <option value="Listening-Writing">Listening-Writing</option>
    <option value="Listening">Listening</option>
    <option value="Reading">Reading</option>
    <option value="Writing">Writing</option>
    <option value="Speaking">Speaking</option>
</datalist>

<script type="text/javascript" src="lesson.js"></script>
<script type="text/javascript" src="class-builder.js"></script>

</html>