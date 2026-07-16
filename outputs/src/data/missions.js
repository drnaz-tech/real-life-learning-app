const mission = (order, level, title, hook, materials, steps, evidence, icon) => ({
  id: `mission-${String(order).padStart(2, '0')}`,
  order,
  level,
  title,
  hook,
  materials,
  steps,
  evidence,
  icon
});

export const LEVELS = [
  { id: 'easy', name: 'Easy', range: 'Missions 1–12', color: 'mint', icon: '🌱', xp: 80, badge: 'Curious Sprout', reward: 'Pick a 20-minute family activity' },
  { id: 'medium', name: 'Medium', range: 'Missions 13–25', color: 'blue', icon: '🧭', xp: 120, badge: 'Brave Pathfinder', reward: 'Choose a screen-free afternoon plan' },
  { id: 'hard', name: 'Hard', range: 'Missions 26–38', color: 'peach', icon: '🔥', xp: 180, badge: 'Bold Maker', reward: 'Choose a real-world outing with a parent' },
  { id: 'expert', name: 'Expert', range: 'Missions 39–49', color: 'lilac', icon: '🌌', xp: 260, badge: 'Orbit & Oak Master', reward: 'Design a special family adventure' }
];

export const MISSIONS = [
  mission(1, 'easy', 'Texture treasure', 'Find three textures hiding in your home.', ['Notebook', 'Crayon'], ['Find three different textures.', 'Make a rubbing of each one.', 'Give each texture a funny name.'], 'Photograph the three rubbings together.', '🪵'),
  mission(2, 'easy', 'Shape safari', 'Become a shape detective for ten minutes.', ['Paper', 'Pencil'], ['Find a circle, triangle, rectangle, and oval.', 'Draw one real object for each shape.', 'Circle the shape that was hardest to find.'], 'Photograph your four-object shape page.', '🔺'),
  mission(3, 'easy', 'Sound map', 'Listen closely to the place where you live.', ['Paper', 'Pencil'], ['Sit quietly for two minutes.', 'Draw a dot for every sound you hear.', 'Connect each dot to where the sound came from.'], 'Photograph your sound map.', '👂'),
  mission(4, 'easy', 'Pocket museum', 'Curate a tiny museum from safe objects.', ['Three safe household objects', 'Paper'], ['Choose three objects with different stories.', 'Arrange them like a museum display.', 'Write one sentence about each object.'], 'Photograph the display and labels.', '🏺'),
  mission(5, 'easy', 'Shadow sketch', 'Watch a shadow change shape.', ['Paper', 'Pencil', 'Sunny window or lamp'], ['Place one object near light.', 'Trace its shadow.', 'Wait ten minutes and trace it again.'], 'Photograph both shadow drawings.', '☀️'),
  mission(6, 'easy', 'Kindness postcard', 'Make a small surprise for someone at home.', ['Paper', 'Crayons or pencils'], ['Draw a picture for someone.', 'Write one true thing you appreciate.', 'Leave it somewhere they will find it.'], 'Photograph the postcard before you hide it.', '💌'),
  mission(7, 'easy', 'Leaf scientist', 'Look at one leaf like a scientist.', ['One fallen leaf', 'Paper', 'Pencil'], ['Draw the leaf outline.', 'Add its veins and five tiny details.', 'Write one question about the leaf.'], 'Photograph your leaf study beside the real leaf.', '🍃'),
  mission(8, 'easy', 'Build a bridge', 'Make a bridge that can hold a small book.', ['Paper', 'Two cups or blocks', 'Small book'], ['Place the supports apart.', 'Fold or roll paper into a bridge.', 'Test it and change one thing if it bends.'], 'Photograph your bridge holding the book.', '🌉'),
  mission(9, 'easy', 'Moon texture map', 'Turn a bumpy surface into a moon.', ['Notebook', 'Crayon', 'Textured object'], ['Make a texture rubbing.', 'Add three craters.', 'Name your moon.'], 'Photograph your moon map.', '🌙'),
  mission(10, 'easy', 'Color hunt', 'Find the colors of a sunset without leaving home.', ['Paper', 'Any drawing tools'], ['Choose five colors.', 'Find one object for each color.', 'Arrange and draw your color line.'], 'Photograph the color line with the objects.', '🌈'),
  mission(11, 'easy', 'Tiny story', 'Write a story that fits in six sentences.', ['Paper', 'Pencil'], ['Choose a hero and a place.', 'Give the hero one small problem.', 'End with a surprising kindness.'], 'Photograph or upload the handwritten story.', '📖'),
  mission(12, 'easy', 'Mini maker fair', 'Show what you learned in the Easy level.', ['Your favorite mission materials', 'Paper'], ['Choose two favorite creations.', 'Make a title card for each.', 'Set up a tiny exhibition for your family.'], 'Photograph your mini maker fair.', '🎪'),

  mission(13, 'medium', 'Measure your morning', 'Collect real measurements from your routine.', ['Paper', 'Ruler or measuring tape'], ['Measure three objects you use each morning.', 'Record each length in centimeters or inches.', 'Order them from shortest to longest.'], 'Photograph the measured objects and chart.', '📏'),
  mission(14, 'medium', 'Wind watcher', 'Make a tool that shows which way the air moves.', ['Paper', 'Straw or stick', 'Tape', 'Small scrap of ribbon'], ['Build a simple wind streamer.', 'Test it in three places.', 'Draw arrows showing the air direction.'], 'Photograph your tool and direction drawings.', '🍃'),
  mission(15, 'medium', 'Recipe fractions', 'Turn a snack recipe into a math puzzle.', ['A simple family snack recipe', 'Paper'], ['Choose a recipe with at least three ingredients.', 'Write the amount for one serving.', 'Work out the amount for two servings.'], 'Photograph both ingredient lists.', '🥣'),
  mission(16, 'medium', 'Household constellation', 'Connect objects into a constellation with a story.', ['Ten small safe objects', 'Paper'], ['Arrange the objects like stars.', 'Draw the constellation.', 'Write a three-sentence origin story.'], 'Photograph the arrangement and story.', '✨'),
  mission(17, 'medium', 'Water saver', 'Investigate one way your home uses water.', ['Paper', 'Pencil'], ['Choose one water habit to observe.', 'Estimate how many times it happens in a day.', 'Design a small reminder sign.'], 'Photograph the sign in its real location.', '💧'),
  mission(18, 'medium', 'Balance lab', 'Make a balanced sculpture from everyday objects.', ['Six safe household objects'], ['Predict which object will be the base.', 'Build the tallest stable sculpture.', 'Make one change and compare it.'], 'Photograph the final sculpture.', '⚖️'),
  mission(19, 'medium', 'Nature alphabet', 'Find real things that begin with five letters.', ['Paper', 'Pencil'], ['Choose five different letters.', 'Find a nature word for each.', 'Draw each item or collect only fallen pieces.'], 'Photograph your alphabet page.', '🔤'),
  mission(20, 'medium', 'Shadow clock', 'Use shadows to make a time marker.', ['Stick or pencil', 'Paper', 'Sunny spot'], ['Stand the stick upright.', 'Mark the shadow tip now.', 'Return later and mark it again.'], 'Photograph the two shadow marks.', '🕒'),
  mission(21, 'medium', 'Recycled robot', 'Build a helper from clean recycling.', ['Clean cardboard or boxes', 'Tape', 'Drawing tools'], ['Choose one job for your robot.', 'Build a body with two moving parts.', 'Give it a name and instruction card.'], 'Photograph the robot and card.', '🤖'),
  mission(22, 'medium', 'Question jar', 'Ask better questions about something ordinary.', ['Jar or bowl', 'Paper strips', 'Pencil'], ['Choose an ordinary object.', 'Write five questions about it.', 'Answer one question by observing or testing.'], 'Photograph the question jar and answer.', '❓'),
  mission(23, 'medium', 'Pattern walk', 'Spot a repeating pattern in the world.', ['Paper', 'Pencil'], ['Find a repeating pattern at home or outside.', 'Copy at least three repeats.', 'Invent a new repeat using the same rule.'], 'Photograph both patterns.', '🔁'),
  mission(24, 'medium', 'Family field guide', 'Make a field guide entry for a nearby living thing.', ['Paper', 'Pencil', 'Optional magnifier'], ['Observe without touching.', 'Draw the shape and two details.', 'Write where it lives and what it might need.'], 'Photograph your field guide entry.', '🔎'),
  mission(25, 'medium', 'Medium level gallery', 'Explain your best experiment so far.', ['Two completed creations', 'Paper'], ['Choose one success and one failed attempt.', 'Draw what changed between them.', 'Tell a grown-up what you would test next.'], 'Photograph the comparison page.', '🖼️'),

  mission(26, 'hard', 'Paper engineering', 'Design a paper tower that reaches a target height.', ['Five sheets of paper', 'Tape', 'Ruler'], ['Choose a target height.', 'Build a tower using only paper and tape.', 'Test it three times and record the result.'], 'Photograph the tower and test notes.', '🏗️'),
  mission(27, 'hard', 'Mystery sound machine', 'Build an instrument from ordinary materials.', ['Clean containers', 'Rubber bands or rice', 'Tape'], ['Choose the sound you want.', 'Build an instrument that makes it.', 'Change one part and describe the difference.'], 'Photograph the instrument and sound notes.', '🥁'),
  mission(28, 'hard', 'Food chain cards', 'Create a chain that shows who needs whom.', ['Paper', 'Drawing tools'], ['Choose a local habitat.', 'Make cards for five living things.', 'Connect the cards from sun to top consumer.'], 'Photograph the connected food chain.', '🦋'),
  mission(29, 'hard', 'Design for a creature', 'Invent a shelter for a tiny imaginary creature.', ['Recycled materials', 'Tape', 'Paper'], ['Decide what your creature needs to survive.', 'Build a shelter with two features.', 'Draw a labeled floor plan.'], 'Photograph the shelter and floor plan.', '🏠'),
  mission(30, 'hard', 'One-day data diary', 'Collect a small set of data about your day.', ['Paper', 'Pencil'], ['Choose one measurable habit.', 'Record it at four different times.', 'Make a bar or line chart by hand.'], 'Photograph the completed chart.', '📊'),
  mission(31, 'hard', 'Human compass', 'Map a room using directions and landmarks.', ['Paper', 'Pencil', 'Optional compass'], ['Stand at one fixed point.', 'Mark north, south, east, and west.', 'Draw five landmarks using a simple key.'], 'Photograph the map and key.', '🧭'),
  mission(32, 'hard', 'Repair story', 'Find something small that can be repaired or improved.', ['Safe object', 'Paper', 'Tape or materials that fit'], ['Ask a grown-up before touching tools.', 'Draw the object before the change.', 'Make one safe improvement and draw after.'], 'Photograph before and after drawings.', '🧰'),
  mission(33, 'hard', 'Plant prediction', 'Make a prediction about a seed or plant.', ['Plant or seed', 'Paper', 'Water'], ['Draw what you see today.', 'Write a prediction for tomorrow.', 'Choose one thing to keep the same while observing.'], 'Photograph the starting observation.', '🌿'),
  mission(34, 'hard', 'Story from an object', 'Write from the point of view of an everyday object.', ['One household object', 'Paper'], ['Study the object closely.', 'Write its first-person voice.', 'Include one thing it wishes people understood.'], 'Photograph the handwritten story.', '🪑'),
  mission(35, 'hard', 'Bridge challenge', 'Build a bridge that carries more than your Easy bridge.', ['Paper', 'Tape', 'Two supports', 'Coins or blocks'], ['Choose a span length.', 'Build and test a bridge.', 'Add weight one piece at a time and record the limit.'], 'Photograph the bridge with its load and notes.', '🌉'),
  mission(36, 'hard', 'Community postcard', 'Notice one helpful feature in your neighborhood.', ['Paper', 'Drawing tools'], ['Observe a safe nearby place with a grown-up.', 'Draw one feature that helps people.', 'Write one idea to make it even better.'], 'Photograph the postcard or drawing.', '🏘️'),
  mission(37, 'hard', 'Teach it back', 'Teach a younger person or grown-up one skill.', ['Paper', 'Materials for your skill'], ['Choose a skill you can explain safely.', 'Make a three-step instruction card.', 'Teach it and ask what was unclear.'], 'Photograph the instruction card.', '🧑‍🏫'),
  mission(38, 'hard', 'Maker documentary', 'Tell the story of one thing you made.', ['Three creations', 'Paper'], ['Choose one creation.', 'Draw three stages of its making.', 'Write what you changed and why.'], 'Photograph the three-stage story.', '🎬'),

  mission(39, 'expert', 'Mini ecosystem', 'Design a closed-loop ecosystem on paper.', ['Paper', 'Drawing tools'], ['Choose a habitat and five parts of it.', 'Show how matter and energy move.', 'Label one risk and one way the system could recover.'], 'Photograph the labeled ecosystem diagram.', '🌎'),
  mission(40, 'expert', 'Constraint machine', 'Invent a machine that solves a real household problem.', ['Recycled materials', 'Tape', 'Paper'], ['Name the problem and three constraints.', 'Build a rough prototype.', 'Test it twice and record one redesign.'], 'Photograph the prototype and redesign notes.', '⚙️'),
  mission(41, 'expert', 'Evidence hunt', 'Make a claim and gather evidence for it.', ['Paper', 'Pencil'], ['Write a claim about something you can observe.', 'Collect five pieces of evidence.', 'Write whether the evidence supports your claim.'], 'Photograph the claim and evidence table.', '🧪'),
  mission(42, 'expert', 'Human-centered redesign', 'Improve an everyday routine for someone else.', ['Paper', 'Pencil'], ['Interview a family member about one frustration.', 'Sketch two possible improvements.', 'Choose one and explain the trade-off.'], 'Photograph the interview notes and redesign.', '💡'),
  mission(43, 'expert', 'Explain a system', 'Draw a system with inputs, actions, and results.', ['Paper', 'Drawing tools'], ['Choose a familiar system.', 'Draw at least three inputs and three results.', 'Circle where a small change could help.'], 'Photograph the complete system map.', '🔗'),
  mission(44, 'expert', 'Memory theatre', 'Turn a real memory into a scene someone else can follow.', ['Paper', 'Drawing tools'], ['Choose one safe family memory.', 'Map the beginning, middle, and turning point.', 'Create one prop or sound effect.'], 'Photograph the scene map and prop.', '🎭'),
  mission(45, 'expert', 'Data story', 'Turn observations into a clear argument.', ['Paper', 'Pencil', 'Ruler'], ['Collect at least eight observations.', 'Choose the clearest chart type.', 'Write a conclusion and one limitation.'], 'Photograph the chart and conclusion.', '📈'),
  mission(46, 'expert', 'Design a fair game', 'Create a game where the rules feel fair.', ['Paper', 'Small objects for pieces'], ['Write the goal and turn rules.', 'Play one test round.', 'Change one rule after hearing player feedback.'], 'Photograph the rule sheet and game setup.', '🎲'),
  mission(47, 'expert', 'Future letter', 'Write to yourself one year from now.', ['Paper', 'Envelope'], ['Describe one thing you are learning now.', 'Make one promise about how you will notice the world.', 'Seal the letter for a grown-up to keep.'], 'Photograph the sealed letter, not its private contents.', '✉️'),
  mission(48, 'expert', 'Open-ended build', 'Make something useful with materials you already have.', ['Three safe found materials', 'Tape or string'], ['Set your own purpose and constraints.', 'Build a first version.', 'Improve it after testing and explain the choice.'], 'Photograph the final build and explanation.', '🛠️'),
  mission(49, 'expert', 'Orbit & Oak showcase', 'Create a final showcase of your real-world learning.', ['Your favorite creations', 'Paper', 'Drawing tools'], ['Choose three missions that changed how you see something.', 'Arrange a small family showcase.', 'Tell the story of your next thing to learn.'], 'Photograph the showcase and your next-learning note.', '🌌')
];

export const BADGES = [
  { id: 'first-launch', name: 'First launch', description: 'Complete your first real-world mission.', icon: '🚀', kind: 'earned' },
  { id: 'curious-hands', name: 'Curious hands', description: 'Complete three missions with physical materials.', icon: '👐', kind: 'earned' },
  { id: 'great-observer', name: 'Great observer', description: 'Complete five missions that begin with noticing.', icon: '🔭', kind: 'earned' },
  { id: 'curious-sprout', name: 'Curious Sprout', description: 'Finish all 12 Easy missions.', icon: '🌱', level: 'easy' },
  { id: 'brave-pathfinder', name: 'Brave Pathfinder', description: 'Finish all 13 Medium missions.', icon: '🧭', level: 'medium' },
  { id: 'bold-maker', name: 'Bold Maker', description: 'Finish all 13 Hard missions.', icon: '🔥', level: 'hard' },
  { id: 'orbit-master', name: 'Orbit & Oak Master', description: 'Finish all 11 Expert missions.', icon: '🌌', level: 'expert' }
];

export const getMission = (id) => MISSIONS.find((item) => item.id === id);
export const getLevel = (id) => LEVELS.find((item) => item.id === id);
export const getMissionsForLevel = (level) => MISSIONS.filter((item) => item.level === level);
