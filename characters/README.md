# Character folder for the people-scene pages

The two `*_people_scenes_folder.html` pages choose their people from this folder.

* Each file is a character in the normal `house-character/1` format, the same format the character poser saves. A file can also hold a list of characters, either as `[...]` or as `{"characters": [...]}`.
* `index.json` lists the files, and a page on a web server (GitHub Pages) reads it to find them. Run `python make_index.py` here after you add or remove files.
* If you open a page straight from your computer, choose this folder with the **📁 Characters** button or drop the folder on the scene. You don't need `index.json` for that.

## The optional `cast` block

```json
"cast": { "pose": "walking", "scenes": ["street", "beach"], "noMirror": true }
"cast": { "pose": "playing", "musician": "violinist", "role": "playing the violin" }
```

* **pose** is one of: standing, walking, waving, hips, reaching, pointing, pointing-item, mopping, sweeping, seated, riding, skating, driving or playing. It decides where the person goes in the scene and which action appears in the key. If you leave it out, the page works it out from what the character has:
  * a chair or beach chair: seated
  * a bicycle: riding
  * a skateboard: skating
  * a car: driving
  * a mop or broom: mopping or sweeping
  * anything else: standing
* **scenes** names the scenes the person can appear in: street, party, classroom, beach or restaurant. Leave it out to allow any scene that suits the pose. Bicycles and skateboards only appear on the street and the beach, cars only on the street, and seated people only where there are seats.
* **musician** names the place on the stage the person can fill:
  * party stage: rock_guitarist, rock_bassist, drummer, keyboard_player, rock_vocalist or hip_hop_vocalist
  * restaurant stage: violinist, cellist, bassist, mandolinist, singer, pianist or piano_singer
* **role** is the sentence used for a musician, for example "playing the violin".
* **noMirror** stops the page showing the person as a mirror image. Everyone else is mirrored at random half the time.

Names must be different within one scene, so the more names the folder has, the more people a scene can use. You can view and edit the `cast` block in the character poser's **Scene casting** panel, and the poser keeps it when you save.
