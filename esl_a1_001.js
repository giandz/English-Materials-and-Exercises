var the_class = {
	"title": "What's your name?",
	"language": "en",
	"level": "a1",
	"course": "esl",
	"type": "systems",
	"subtype": "vocabulary",
	"number": 1,
	"stages": {
		"stage1": {
			"title": "Lead-In",
			"entries": {
				"entry1":{
					"type": "instruction",
					"content": "Look at the picture(👁🖼):"
				},
				"entry2":{
					"type": "picture",
					"source": "unsplash.com",
					"url": "https://images.unsplash.com/photo-1492538368677-f6e0afe31dcc?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80"
				},				
				"entry3":{
					"type": "instruction",
					"content": "Answer the questions(🧠🖼):"
				},
				"entry4":{
					"type": "selection",
					"random": false,
					"source": "",
					"items": [{
							"q": "🏫 What is this place?",
							"a": "a university",
							"o": [
								"a university",
								"a hospital",
								"a bank"
							]
						},
						{
							"q": "👨‍🏫 Who is this person?",
							"a": "a teacher",
							"o": [
								"a teacher",
								"a chef",
								"a police officer"
							]
						}
					]
				}
			}
		},
		"stage2": {
			"title": "Vocabulary Introduction",
			"entries": {
				"entry1":{
					"type": "instruction",
					"content": "Listen to the conversation(👂💬):"
				},
				"entry2": {
					"type": "conversation",
					"pic": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1351&q=80",
					"audio": "",
					"source": "",
					"characters": [{
							"name": "separator"
						},
						{
							"name": "Julia"
						},	
						{
							"name": "Chen"
						}

					],
					"lines": [{
							"char": "Julia",
							"text": "Hi, I'm Julia. What's your name?"
						},
						{
							"char": "Chen",
							"text": "My name is Chen. Nice to meet you."
						},
						{
							"char": "Julia",
							"text": "Nice to meet you too. Oh, look. The teacher is here."
						},
						{
							"char": "separator",
							"text": "1 hour later"
						},
						{
							"char": "Chen",
							"text": "Great class. Look at the time, I have to go. Bye!"
						},
						{
							"char": "Julia",
							"text": "Wait! What's your phone number?"
						},
						{
							"char": "Chen",
							"text": "Ah, it's 555-323-2121. What about you?"
						},
						{
							"char": "Julia",
							"text": "My phone mumber is 212-555-1231."
						},						
						{
							"char": "Chen",
							"text": "Can you repeat that?"
						},
						{
							"char": "Julia",
							"text": "Sure, 212-555-1231."
						},
						{
							"char": "Chen",
							"text": "Thanks a lot. See you tomorrow, Julia!"
						}
					]
				}
			}
		},
		"stage3": {
			"title": "Clarification",
			"entries": {
				"entry1":{
					"type": "target-language",
					"title": "Personal information",
					"elems": [{
							"type": "instruction",
							"content": "Complete these sentences(💬✍):"
						},
						{
							"type": "exponents",
							"content": [
								"I'm Julia. {What's} {your} name?",
								"My {name} {is} Chen."
							]
						},
						{
							"type": "prompt",
							"content": "The question: 'What's your ___?' ⬅ names, phone numbers, email addresses, etc."
						},			
						{
							"type": "instruction",
							"content": "Answer the questions:"
						},
						{
							"type": "ccqs",
							"ccqs": [{
									"q": "'What's your name?' is:",
									"a": "a question",
									"o": [
										"a question",
										"a statement"
									]
								},
								{

									"q": "'My name is Julia' is:",
									"a": "a statement",
									"o": [
										"a question",
										"a statement"
									]
								}
							]
						},
						{
							"type": "instruction",
							"content": "Complete the structure of the question (📦✍):"
						},
						{
							"type": "structure",
							"spec": "(?)",
							"struct": [
								"wh-word",
								"be",
								"possessive",
								"noun",
								"question mark"
							],
							"exp": [
								[
									"What",
									"is",
									"your",
									"name",
									"?"
								],
								[
									"What",
									"'s",
									"your",
									"phone number",
									"?"
								]
							]
						},
						{
							"type": "instruction",
							"content": "Complete the structure of the statement (📦✍):"
						},
						{
							"type": "structure",
							"spec": "(+)",
							"struct": [

								"possessive",
								"noun",
								"be",
								"(info)"
							],
							"exp": [
								[
									"My",
									"name",
									"'s",
									"Fabio."
								],
								[
									"My",
									"email address",
									"is",
									"fabi23@mail.com."
								]
							]
						}
					]
				}
			}
		}, 
		"stage4": {
			"title": "Practice",
			"entries": {
				"entry1":{
					"type": "instruction",
					"content": "Complete the chart (📊✍):"
				},
				"entry2": {
					"type": "sorting",
					"box": true,
					"categories":[
						{"name":"First Name","items":["Sandra", "Abdul"]},
						{"name":"Last Name", "items":["Gonzalez", "Chan"]},
						{"name":"Phone Number", "items":["333-555-1212","555-123-7878"]},
						{"name":"E-mail Address", "items":["lola_23@mail.com", "frankyrulz@mail.com"]}
					]
				},
				"entry3":{
					"type": "instruction",
					"content": "Complete the conversations (💬✍):"
				},
				"entry4":{
					"type": "gapfill",
					"text": "Martha: Nice to meet you, {my} name {is} Martha.|Felipe: Excuse me, {what's} your {name} again?|Martha: It's Martha. What {about} you?|Felipe: My name is Felipe, {nice} to {meet} you.|Martha: Nice {to} meet you {too}, Felipe."
				},

				"entry5":{
					"type": "gapfill",
					"text": "Felipe: What's {your} e-mail address, Julia?|Julia: {It's} juli95@mail.com.|Felipe: What about your {phone} number?|Julia: My phone {number} is 555-312-4545.|Felipe: Can you {repeat} that?|Julia: {Sure}, 555-312-4545|Felipe: {Thanks} a lot, Julia.|Julia: {See} {you} tomorrow, Felipe."
				}
			}
		},
		"stage5": {
			"title": "Production",
			"entries": {
				"entry1":{
					"type": "instruction",
					"content": "Ask questions to your classmates. Write down their personal information (🗣👥👂✍):"
				},
				"entry2":{
					"type": "scratchpad"
				}
			}
		},
		"stage6": {
			"title": "Feedback",
			"entries": {
				"entry1":{
					"type": "instruction",
					"content": "Your teacher will write sentences. Are they correct? Correct the errors:(👩‍🏫❓✍)"
				},
				"entry2": {
					"type": "instruction",
					"content": "Stand by for the homework:(⏳🎒)"
				}
			}
		}
	}
}