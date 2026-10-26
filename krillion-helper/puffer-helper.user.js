// ==UserScript==
// @name         Krillion Puffer Helper
// @namespace    https://github.com/GamingDude123/Website
// @version      0.4.1
// @description  Shows suggested answers for the current Puffer Party category in a small sidebar.
// @match        https://krillion.io/*
// @match        https://*.krillion.io/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      en.wikipedia.org
// @connect      api.datamuse.com
// @updateURL    https://raw.githubusercontent.com/GamingDude123/Website/claude/magical-rubin-okrvsh/krillion-helper/puffer-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/GamingDude123/Website/claude/magical-rubin-okrvsh/krillion-helper/puffer-helper.user.js
// ==/UserScript==

(() => {
"use strict";

// Cross-origin GET that works even if the site's CSP blocks fetch().
function getJSON(url) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "GET",
      url,
      onload: (r) => (r.status >= 200 && r.status < 300 ? resolve(JSON.parse(r.responseText)) : reject(new Error(`HTTP ${r.status}`))),
      onerror: () => reject(new Error("network error")),
      ontimeout: () => reject(new Error("timeout")),
      timeout: 6000
    });
  });
}

// Free, keyless answer source: bundled lists first, then Wikipedia categories / list pages.
// Results are cached per topic so repeat categories need no network at all.
const WIKI = "https://en.wikipedia.org/w/api.php";

// ---- built-in answer lists (generated from categories.txt by build.py; most common answers first) ----
/*@@DATA_START@@*/
const DATA = "military rank | military rank, army rank, navy rank, rank military, air force rank, soldier rank | General, Colonel, Major, Captain, Lieutenant, Sergeant, Corporal, Private, Admiral, Commander, Ensign, Brigadier, Marshal, Commodore, Specialist, Warrant Officer, Staff Sergeant, Master Sergeant, Sergeant Major, Lance Corporal, Airman, Seaman, Midshipman, Cadet, Recruit, Field Marshal, Rear Admiral, Vice Admiral, Petty Officer, Chief, Second Lieutenant, First Lieutenant, Squadron Leader, Wing Commander, Group Captain, Flight Lieutenant, Bombardier, Gunner, Trooper, Fusilier, Sapper\ncountry | country, nation | France, Germany, Italy, Spain, Japan, China, India, Brazil, Canada, Mexico, Australia, Russia, Egypt, Argentina, Peru, Chile, Colombia, Cuba, Kenya, Nigeria, Ghana, Morocco, Turkey, Greece, Sweden, Norway, Denmark, Finland, Poland, Ireland, Portugal, Netherlands, Belgium, Switzerland, Austria, Ukraine, Thailand, Vietnam, Indonesia, Philippines, South Korea, Pakistan, Iran, Iraq, Israel, Saudi Arabia, South Africa, New Zealand, Jamaica, Iceland, Hungary, Romania, Croatia, Nepal, Cambodia, Ethiopia, Madagascar, Mongolia, Bolivia, Venezuela\nus state | us state, american state, state in america, state in the us, united states state, state of the us | Texas, California, Florida, New York, Ohio, Maine, Utah, Iowa, Nevada, Oregon, Alaska, Georgia, Hawaii, Idaho, Arizona, Colorado, Kansas, Montana, Alabama, Michigan, Illinois, Indiana, Kentucky, Louisiana, Maryland, Minnesota, Mississippi, Missouri, Nebraska, New Jersey, New Mexico, North Carolina, North Dakota, Oklahoma, Pennsylvania, South Carolina, South Dakota, Tennessee, Vermont, Virginia, Washington, West Virginia, Wisconsin, Wyoming, Delaware, Connecticut, Arkansas, Massachusetts, New Hampshire, Rhode Island\ncapital city | capital, capital city | Paris, London, Tokyo, Rome, Madrid, Berlin, Moscow, Beijing, Cairo, Ottawa, Canberra, Washington, Lima, Santiago, Bogota, Havana, Athens, Lisbon, Dublin, Oslo, Stockholm, Helsinki, Warsaw, Vienna, Prague, Budapest, Bangkok, Hanoi, Seoul, Delhi, Nairobi, Tehran, Baghdad, Ankara, Kyiv, Brussels, Amsterdam, Bern, Copenhagen, Reykjavik, Jakarta, Manila, Lima, Quito, Caracas\ncity | city, big city, major city, world city, famous city | New York, London, Paris, Tokyo, Los Angeles, Chicago, Miami, Rome, Berlin, Madrid, Sydney, Toronto, Dubai, Moscow, Beijing, Shanghai, Mumbai, Cairo, Rio, Seattle, Boston, Dallas, Houston, Atlanta, Denver, Las Vegas, Phoenix, Philadelphia, San Francisco, Vancouver, Barcelona, Amsterdam, Istanbul, Bangkok, Singapore, Seoul, Mexico City, Lagos, Nairobi, Cape Town, Venice\nocean sea water | ocean, sea, body of water | Pacific, Atlantic, Indian, Arctic, Southern, Mediterranean, Caribbean, Red Sea, Black Sea, Baltic, North Sea, Caspian, Dead Sea, Coral Sea, Arabian Sea, South China Sea, Bering Sea, Gulf of Mexico, Adriatic, Aegean\nriver | river | Nile, Amazon, Mississippi, Thames, Danube, Rhine, Seine, Yangtze, Ganges, Missouri, Colorado, Hudson, Volga, Congo, Mekong, Tigris, Euphrates, Jordan, Niagara, Ohio, Rio Grande, Yellow, Indus, Orinoco, Zambezi, Loire, Tiber, Po, Elbe\nmountain | mountain, mountain range, peak | Everest, K2, Kilimanjaro, Denali, Fuji, Matterhorn, Mont Blanc, Rushmore, Elbrus, Aconcagua, Olympus, Vesuvius, Etna, Rainier, Whitney, Sinai, Ararat, Annapurna, Kangchenjunga, Lhotse, Alps, Andes, Rockies, Himalayas, Appalachians\ncontinent | continent | Asia, Africa, Europe, North America, South America, Antarctica, Australia, Oceania\nplanet | planet, solar system | Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Moon, Sun, Titan, Europa, Io, Ceres\nelement | element, chemical element, periodic table | Hydrogen, Oxygen, Carbon, Iron, Gold, Silver, Helium, Neon, Copper, Zinc, Sodium, Lead, Nitrogen, Calcium, Potassium, Chlorine, Mercury, Tin, Aluminum, Nickel, Platinum, Uranium, Lithium, Silicon, Sulfur, Phosphorus, Argon, Iodine, Magnesium, Titanium, Cobalt, Radium, Plutonium, Krypton, Xenon, Boron, Fluorine, Tungsten\ncolor | color, colour, shade | Red, Blue, Green, Yellow, Orange, Purple, Pink, Black, White, Brown, Gray, Gold, Silver, Teal, Turquoise, Violet, Indigo, Maroon, Navy, Cyan, Magenta, Beige, Tan, Lime, Crimson, Scarlet, Lavender, Peach, Coral, Mint, Olive, Aqua, Bronze, Amber, Ivory\nshape | shape, geometric shape | Circle, Square, Triangle, Rectangle, Oval, Star, Heart, Diamond, Pentagon, Hexagon, Octagon, Cube, Sphere, Cone, Cylinder, Pyramid, Crescent, Rhombus, Trapezoid, Parallelogram, Arrow, Cross\nfruit | fruit | Apple, Banana, Orange, Grape, Mango, Pear, Peach, Cherry, Lemon, Strawberry, Plum, Kiwi, Pineapple, Watermelon, Blueberry, Raspberry, Lime, Grapefruit, Coconut, Papaya, Apricot, Fig, Pomegranate, Cantaloupe, Blackberry, Cranberry, Avocado, Tangerine, Nectarine, Guava, Lychee, Dragon Fruit, Passion Fruit, Date, Honeydew, Persimmon, Currant, Mulberry\nvegetable | vegetable, veggie | Carrot, Broccoli, Potato, Onion, Spinach, Celery, Pepper, Lettuce, Corn, Cabbage, Pea, Cucumber, Tomato, Garlic, Cauliflower, Asparagus, Zucchini, Mushroom, Kale, Radish, Beet, Squash, Eggplant, Pumpkin, Turnip, Leek, Artichoke, Green Bean, Brussels Sprout, Sweet Potato, Parsnip, Okra, Yam, Cassava\nherb spice | herb, spice, seasoning | Basil, Oregano, Thyme, Rosemary, Parsley, Sage, Cinnamon, Pepper, Paprika, Cumin, Turmeric, Ginger, Garlic, Nutmeg, Clove, Mint, Dill, Cilantro, Chives, Saffron, Cardamom, Coriander, Vanilla, Bay Leaf, Mustard, Fennel, Tarragon, Cayenne, Chili\ncheese | cheese | Cheddar, Brie, Gouda, Mozzarella, Parmesan, Feta, Swiss, Camembert, Provolone, Havarti, Blue Cheese, Cottage Cheese, Cream Cheese, Ricotta, Gruyere, Monterey Jack, Colby, Pepper Jack, Edam, Gorgonzola, Manchego, Halloumi, Roquefort, Mascarpone, Asiago, Stilton, Muenster, American\npasta | pasta, noodle | Spaghetti, Penne, Macaroni, Fettuccine, Linguine, Lasagna, Ravioli, Rigatoni, Fusilli, Farfalle, Tortellini, Orzo, Ziti, Angel Hair, Rotini, Gnocchi, Cannelloni, Penne Rigate, Tagliatelle, Vermicelli, Manicotti, Shells, Bucatini, Pappardelle, Orecchiette\nbread | bread, bakery item | Baguette, Sourdough, Rye, Ciabatta, Bagel, Pita, Naan, Tortilla, Croissant, Brioche, Focaccia, Cornbread, Flatbread, Toast, Roll, Biscuit, Pretzel, Muffin, Wheat, White Bread, Pumpernickel, Challah, Banana Bread, Garlic Bread, English Muffin, Scone\ndessert | dessert, sweet, pastry, baked good, baked goods | Cake, Pie, Ice Cream, Cookie, Brownie, Cupcake, Donut, Pudding, Cheesecake, Tiramisu, Cobbler, Eclair, Macaron, Sundae, Flan, Fudge, Trifle, Mousse, Gelato, Churro, Baklava, Crepe, Waffle, Pancake, Cannoli, Strudel, Parfait, Sorbet, Tart, Danish, Truffle\ncandy | candy, chocolate bar, sweets | Snickers, Twix, Skittles, M&Ms, Kit Kat, Reese's, Hershey's, Milky Way, Starburst, Twizzlers, Jolly Rancher, Sour Patch Kids, Gummy Bears, Lollipop, Mars, Butterfinger, Nerds, Swedish Fish, Smarties, Tootsie Roll, Mentos, Life Savers, Airheads, Peeps, Toblerone, Hot Tamales, Mike and Ike, Milk Duds, Laffy Taffy, Haribo\nfast food | fast food, restaurant, fast food chain, restaurant chain, burger place | McDonald's, Burger King, Wendy's, Taco Bell, KFC, Subway, Pizza Hut, Domino's, Chick-fil-A, Popeyes, Arby's, Chipotle, Sonic, Dunkin', Starbucks, Panera, Five Guys, In-N-Out, Jack in the Box, Papa John's, Dairy Queen, Panda Express, Culver's, Whataburger, Carl's Jr., Little Caesars, Applebee's, Olive Garden, Chili's, Denny's, IHOP\ncereal | cereal, breakfast cereal | Cheerios, Frosted Flakes, Lucky Charms, Froot Loops, Cinnamon Toast Crunch, Cocoa Puffs, Corn Flakes, Rice Krispies, Raisin Bran, Special K, Honey Nut Cheerios, Cap'n Crunch, Trix, Fruity Pebbles, Wheaties, Apple Jacks, Honey Bunches of Oats, Kix, Chex, Golden Grahams, Captain Crunch, Life, Corn Pops, Frosted Mini-Wheats, Grape-Nuts\ndrink | drink, beverage, soft drink, soda | Water, Coffee, Tea, Milk, Juice, Soda, Lemonade, Cola, Smoothie, Cocoa, Coke, Pepsi, Sprite, Fanta, Dr Pepper, Mountain Dew, Gatorade, Red Bull, Root Beer, Ginger Ale, Orange Juice, Apple Juice, Iced Tea, Energy Drink, Milkshake, Hot Chocolate, Kombucha, Sparkling Water, Tonic\nalcohol | alcohol, alcoholic drink, cocktail, liquor, beer, wine | Beer, Wine, Vodka, Whiskey, Rum, Gin, Tequila, Champagne, Brandy, Bourbon, Scotch, Cider, Sake, Margarita, Mojito, Martini, Cosmopolitan, Daiquiri, Old Fashioned, Manhattan, Bloody Mary, Pina Colada, Mimosa, Sangria, Whisky, Absinthe, Cognac, Vermouth, Lager, Ale, Stout, IPA\ncoffee | coffee, coffee drink, starbucks drink | Espresso, Latte, Cappuccino, Americano, Mocha, Macchiato, Flat White, Cortado, Frappuccino, Cold Brew, Iced Coffee, Drip, Affogato, Doppio, Ristretto, Lungo, Irish Coffee, Turkish Coffee, Red Eye\nmeat | meat, protein | Beef, Chicken, Pork, Lamb, Turkey, Bacon, Ham, Sausage, Steak, Duck, Venison, Veal, Salami, Pepperoni, Ribs, Brisket, Hot Dog, Meatball, Goat, Bison, Rabbit, Prosciutto, Jerky\nnut | nut | Almond, Peanut, Cashew, Walnut, Pecan, Pistachio, Hazelnut, Macadamia, Brazil Nut, Chestnut, Pine Nut, Acorn, Coconut, Peanut Butter\nseafood | seafood, shellfish | Shrimp, Lobster, Crab, Salmon, Tuna, Oyster, Clam, Scallop, Mussel, Squid, Octopus, Cod, Halibut, Tilapia, Sardine, Anchovy, Crawfish, Eel, Swordfish, Mahi Mahi, Calamari, Caviar\nanimal | animal, wild animal, creature | Dog, Cat, Horse, Lion, Tiger, Bear, Wolf, Fox, Elephant, Giraffe, Monkey, Zebra, Cow, Pig, Sheep, Deer, Rabbit, Mouse, Rat, Squirrel, Kangaroo, Panda, Gorilla, Leopard, Cheetah, Hippo, Rhino, Camel, Bat, Raccoon, Skunk, Otter, Beaver, Hedgehog, Koala, Moose, Buffalo, Goat, Donkey, Chimpanzee, Hyena, Jaguar, Lemur, Sloth, Armadillo, Platypus\nmammal | mammal | Dog, Cat, Horse, Whale, Dolphin, Bat, Elephant, Human, Bear, Lion, Tiger, Wolf, Kangaroo, Seal, Walrus, Otter, Mouse, Rabbit, Deer, Cow, Pig, Monkey, Platypus, Sloth, Porcupine, Manatee\nocean animal | ocean animal, sea animal, sea creature, marine animal, marine life, ocean creature, underwater animal, aquatic animal, animal ocean, animal sea | Shark, Whale, Dolphin, Octopus, Jellyfish, Starfish, Seahorse, Crab, Lobster, Turtle, Seal, Sea Lion, Walrus, Squid, Stingray, Clownfish, Eel, Orca, Manatee, Narwhal, Pufferfish, Swordfish, Barracuda, Anglerfish, Sea Urchin, Coral, Shrimp, Oyster, Manta Ray, Sea Otter, Penguin, Krill, Sea Cucumber, Nautilus\nbird | bird | Eagle, Robin, Owl, Sparrow, Penguin, Parrot, Crow, Hawk, Duck, Swan, Falcon, Pigeon, Seagull, Flamingo, Ostrich, Peacock, Turkey, Chicken, Goose, Hummingbird, Woodpecker, Cardinal, Blue Jay, Crane, Heron, Pelican, Vulture, Raven, Dove, Canary, Toucan, Kiwi, Cockatoo, Finch, Albatross, Emu, Quail, Stork, Kingfisher\nfish | fish | Salmon, Tuna, Trout, Bass, Cod, Shark, Goldfish, Catfish, Eel, Carp, Perch, Pike, Tilapia, Swordfish, Clownfish, Piranha, Herring, Sardine, Marlin, Halibut, Flounder, Snapper, Barracuda, Angelfish, Guppy, Seahorse, Pufferfish, Mackerel, Anchovy\nreptile | reptile, amphibian | Snake, Lizard, Turtle, Crocodile, Alligator, Gecko, Iguana, Chameleon, Tortoise, Cobra, Python, Komodo Dragon, Frog, Toad, Salamander, Newt, Rattlesnake, Anaconda, Viper, Boa, Gila Monster, Skink\ninsect | insect, bug, creepy crawly, arachnid | Ant, Bee, Butterfly, Fly, Mosquito, Beetle, Ladybug, Spider, Wasp, Grasshopper, Cricket, Dragonfly, Moth, Cockroach, Caterpillar, Termite, Firefly, Flea, Tick, Scorpion, Centipede, Praying Mantis, Hornet, Earwig, Cicada, Aphid, Tarantula\nfarm animal | farm animal, barnyard animal, livestock | Cow, Pig, Chicken, Sheep, Horse, Goat, Duck, Turkey, Donkey, Rooster, Goose, Llama, Rabbit, Bull, Lamb, Ox, Mule, Alpaca\npet | pet, household pet | Dog, Cat, Fish, Hamster, Rabbit, Bird, Turtle, Guinea Pig, Snake, Parrot, Goldfish, Lizard, Ferret, Gerbil, Horse, Mouse, Rat, Chinchilla, Hedgehog, Tarantula, Gecko, Canary, Parakeet\ndog breed | dog breed, dog, breed of dog, type of dog | Labrador, Poodle, Beagle, Bulldog, Husky, Corgi, Boxer, Dachshund, Pug, Golden Retriever, German Shepherd, Chihuahua, Rottweiler, Great Dane, Doberman, Collie, Terrier, Shih Tzu, Pomeranian, Dalmatian, Greyhound, Saint Bernard, Cocker Spaniel, Border Collie, Maltese, Akita, Bloodhound, Basset Hound, Yorkie, Samoyed, Pit Bull, Australian Shepherd, Mastiff, Whippet, Pointer, Newfoundland, Schnauzer\ncat breed | cat breed, breed of cat, type of cat | Siamese, Persian, Maine Coon, Bengal, Sphynx, Ragdoll, British Shorthair, Abyssinian, Scottish Fold, Russian Blue, Burmese, Birman, Tabby, Calico, Manx, Savannah, Siberian, Tonkinese, Himalayan\nbig cat | big cat, wild cat, feline | Lion, Tiger, Leopard, Cheetah, Jaguar, Panther, Cougar, Lynx, Bobcat, Snow Leopard, Puma, Ocelot, Caracal, Serval, Mountain Lion, Clouded Leopard\ndinosaur | dinosaur | Tyrannosaurus, T. Rex, Triceratops, Velociraptor, Stegosaurus, Brachiosaurus, Diplodocus, Spinosaurus, Allosaurus, Ankylosaurus, Pterodactyl, Apatosaurus, Brontosaurus, Iguanodon, Parasaurolophus, Gallimimus, Megalosaurus, Pachycephalosaurus, Carnotaurus, Dilophosaurus, Archaeopteryx, Compsognathus\nshark | shark | Great White, Hammerhead, Tiger Shark, Bull Shark, Whale Shark, Mako, Nurse Shark, Blue Shark, Lemon Shark, Thresher, Megalodon, Goblin Shark, Basking Shark, Reef Shark, Greenland Shark\nbear | bear | Grizzly, Polar Bear, Black Bear, Panda, Brown Bear, Sloth Bear, Sun Bear, Kodiak, Spectacled Bear, Koala, Teddy Bear, Winnie the Pooh, Paddington, Yogi Bear, Baloo\ntree | tree | Oak, Maple, Pine, Birch, Willow, Elm, Cedar, Palm, Spruce, Ash, Fir, Redwood, Apple, Cherry, Walnut, Beech, Cypress, Poplar, Sycamore, Magnolia, Hickory, Aspen, Mahogany, Baobab, Eucalyptus, Banyan, Sequoia, Teak, Bamboo, Dogwood, Juniper, Hemlock\nflower | flower | Rose, Tulip, Daisy, Lily, Orchid, Sunflower, Daffodil, Violet, Poppy, Lotus, Iris, Lilac, Carnation, Marigold, Lavender, Jasmine, Peony, Dandelion, Hibiscus, Petunia, Pansy, Geranium, Chrysanthemum, Hyacinth, Begonia, Azalea, Zinnia, Lupine, Snapdragon, Daylily\nbody part | body part, part of the body | Head, Arm, Leg, Hand, Foot, Eye, Ear, Nose, Mouth, Neck, Shoulder, Knee, Elbow, Finger, Toe, Chest, Back, Stomach, Hip, Ankle, Wrist, Thumb, Chin, Cheek, Forehead, Tongue, Tooth, Heel, Palm, Thigh, Calf, Spine, Skull, Rib, Lip, Eyebrow, Eyelash, Waist, Hair\norgan bone | organ, bone, internal organ | Heart, Brain, Lung, Liver, Kidney, Stomach, Skin, Intestine, Pancreas, Spleen, Bladder, Skull, Femur, Rib, Spine, Tibia, Humerus, Pelvis, Clavicle, Radius, Ulna, Fibula, Sternum, Patella, Vertebra, Esophagus, Gallbladder, Appendix\nsport | sport, athletic activity, team sport | Soccer, Basketball, Baseball, Football, Tennis, Golf, Hockey, Rugby, Boxing, Cricket, Swimming, Skiing, Volleyball, Wrestling, Track, Gymnastics, Badminton, Cycling, Surfing, Skateboarding, Archery, Fencing, Lacrosse, Softball, Bowling, Karate, Judo, Rowing, Sailing, Polo, Curling, Snowboarding, Table Tennis, Diving, Handball, Weightlifting, MMA, Climbing\nolympic | olympic, olympic sport, summer sport, winter sport | Swimming, Gymnastics, Track, Diving, Archery, Fencing, Rowing, Judo, Boxing, Cycling, Skiing, Skating, Curling, Bobsled, Luge, Biathlon, Snowboarding, Hockey, Volleyball, Weightlifting, Wrestling, Sailing, Shooting, Triathlon, Marathon, Sprint, Hurdles, Pole Vault, Long Jump, Javelin, Discus\nnba team | nba team, basketball team | Lakers, Celtics, Warriors, Bulls, Knicks, Heat, Nets, Spurs, Rockets, Mavericks, Suns, Bucks, 76ers, Raptors, Clippers, Nuggets, Jazz, Thunder, Hawks, Pistons, Cavaliers, Pacers, Magic, Hornets, Wizards, Kings, Blazers, Grizzlies, Pelicans, Timberwolves\nnfl team | nfl team, football team | Patriots, Cowboys, Packers, Steelers, Giants, Eagles, 49ers, Chiefs, Bears, Broncos, Ravens, Seahawks, Dolphins, Jets, Raiders, Rams, Chargers, Colts, Bills, Bengals, Browns, Lions, Vikings, Saints, Falcons, Panthers, Buccaneers, Cardinals, Titans, Jaguars, Texans, Commanders\nmlb team | mlb team, baseball team | Yankees, Red Sox, Dodgers, Cubs, Giants, Cardinals, Braves, Mets, Astros, Phillies, Padres, Mariners, Angels, Tigers, Royals, Twins, Orioles, Rangers, Rays, Marlins, Reds, Pirates, Brewers, Rockies, Guardians, Nationals, Athletics, White Sox, Blue Jays, Diamondbacks\nsoccer team | soccer team, football club, premier league, premier league team | Manchester United, Liverpool, Arsenal, Chelsea, Manchester City, Tottenham, Barcelona, Real Madrid, Bayern Munich, Juventus, PSG, AC Milan, Inter Milan, Ajax, Dortmund, Atletico Madrid, Everton, Newcastle, Aston Villa, West Ham, Celtic, Rangers, Roma, Napoli, Benfica, Porto\nsoccer player | soccer player, footballer | Messi, Ronaldo, Pele, Maradona, Neymar, Mbappe, Beckham, Zidane, Haaland, Salah, Modric, Iniesta, Xavi, Kane, Lewandowski, De Bruyne, Benzema, Ronaldinho, Cruyff, Henry, Rooney, Buffon, Pirlo, Suarez, Ibrahimovic, Hazard, Son, Vinicius\nnba player | nba player, basketball player | LeBron James, Michael Jordan, Kobe Bryant, Stephen Curry, Kevin Durant, Shaquille O'Neal, Magic Johnson, Larry Bird, Kareem Abdul-Jabbar, Tim Duncan, Giannis, Luka Doncic, Nikola Jokic, Dirk Nowitzki, Wilt Chamberlain, Allen Iverson, Dwyane Wade, Kawhi Leonard, James Harden, Russell Westbrook, Charles Barkley, Scottie Pippen, Steve Nash, Dennis Rodman, Chris Paul\nathlete | athlete, famous athlete, sports star | Michael Jordan, LeBron James, Tom Brady, Serena Williams, Usain Bolt, Muhammad Ali, Tiger Woods, Michael Phelps, Lionel Messi, Cristiano Ronaldo, Roger Federer, Babe Ruth, Simone Biles, Wayne Gretzky, Pele, Mike Tyson, Derek Jeter, Shaq, Rafael Nadal, Novak Djokovic, Peyton Manning, Kobe Bryant, Jesse Owens\nboard game | board game, tabletop game, game | Monopoly, Chess, Checkers, Scrabble, Risk, Clue, Sorry, Battleship, Trouble, Candy Land, Connect Four, Jenga, Uno, Catan, Life, Operation, Mouse Trap, Twister, Pictionary, Trivial Pursuit, Backgammon, Go, Mancala, Stratego, Yahtzee, Othello, Chutes and Ladders, Cluedo, Taboo, Boggle, Dominoes, Parcheesi, Ticket to Ride, Carcassonne, Pandemic, Cranium\ncard game | card game, card | Poker, Blackjack, Solitaire, Uno, Go Fish, Hearts, Spades, Rummy, Bridge, War, Crazy Eights, Old Maid, Euchre, Gin Rummy, Texas Hold'em, Baccarat, Cribbage, Spit, Slapjack, Snap, Canasta, Pinochle, Skip-Bo, Magic, Yu-Gi-Oh, Pokemon, Cheat, President\nvideo game | video game, game series, gaming, video game franchise | Minecraft, Fortnite, Roblox, Mario, Zelda, Pokemon, Call of Duty, Halo, Tetris, Pac-Man, Sonic, GTA, Among Us, Overwatch, League of Legends, Fallout, Skyrim, The Sims, Animal Crossing, Super Smash Bros, Mortal Kombat, Street Fighter, Apex Legends, Valorant, Destiny, Cyberpunk, Elden Ring, Portal, Half-Life, Doom, Resident Evil, Metal Gear, Final Fantasy, Kirby, Donkey Kong, Metroid, FIFA, Madden, Rocket League, Terraria, Stardew Valley, Undertale, Hades, Counter-Strike, Pong, Space Invaders, Mario Kart, Splatoon\nconsole | console, game console, gaming console, gaming system, video game console | PlayStation, Xbox, Nintendo Switch, Wii, Game Boy, NES, SNES, Nintendo 64, GameCube, Sega Genesis, Dreamcast, Atari, PS5, PS4, PS3, PS2, Xbox 360, Xbox One, DS, 3DS, PSP, Vita, Steam Deck, Sega Saturn, Game Gear, Neo Geo, Wii U, TurboGrafx\npokemon | pokemon, pokémon | Pikachu, Charizard, Bulbasaur, Squirtle, Charmander, Eevee, Mewtwo, Mew, Jigglypuff, Snorlax, Gengar, Lucario, Gyarados, Psyduck, Meowth, Togepi, Dragonite, Blastoise, Venusaur, Ditto, Magikarp, Onix, Geodude, Machop, Vulpix, Ninetales, Lapras, Umbreon, Espeon, Greninja, Rayquaza, Lugia, Ho-Oh, Mimikyu, Garchomp, Arcanine, Alakazam, Abra, Zubat, Rattata, Pidgey, Caterpie, Weedle\nmario character | mario character, mario, super mario, nintendo character | Mario, Luigi, Peach, Bowser, Toad, Yoshi, Wario, Waluigi, Donkey Kong, Daisy, Rosalina, Koopa, Goomba, Boo, Shy Guy, Toadette, Diddy Kong, Bowser Jr., Birdo, Kamek, Lakitu, Piranha Plant, Bullet Bill, Cappy, Pauline, Link, Zelda, Kirby, Samus, Fox\nminecraft | minecraft, minecraft item, minecraft mob, minecraft block | Creeper, Zombie, Skeleton, Enderman, Spider, Pig, Cow, Sheep, Chicken, Wolf, Villager, Iron Golem, Blaze, Ghast, Ender Dragon, Wither, Slime, Witch, Diamond, Iron, Gold, Coal, Redstone, Emerald, Obsidian, Netherite, Pickaxe, Sword, Axe, Shovel, Bow, Torch, Crafting Table, Furnace, Chest, Bed, TNT, Dirt, Stone, Cobblestone, Wood, Sand, Gravel, Lava\nroblox | roblox | Adopt Me, Brookhaven, Blox Fruits, Tower of Hell, Jailbreak, Murder Mystery, Piggy, Bee Swarm Simulator, Royale High, MeepCity, Pet Simulator, Doors, Arsenal, Natural Disaster Survival, Bloxburg, Work at a Pizza Place, Phantom Forces, Mad City, Theme Park Tycoon, Flee the Facility, Roblox, Robux, Noob, Bacon Hair\nmusical instrument | musical instrument, instrument | Guitar, Piano, Violin, Drums, Flute, Trumpet, Cello, Harp, Saxophone, Clarinet, Banjo, Tuba, Trombone, Bass, Ukulele, Harmonica, Accordion, Oboe, Bassoon, Viola, Xylophone, Tambourine, Triangle, Cymbals, Organ, Keyboard, Mandolin, Bagpipes, Piccolo, French Horn, Recorder, Sitar, Bongo, Maracas, Kazoo, Synthesizer, Timpani, Harpsichord\nmusic genre | music genre, genre of music, type of music, genre | Rock, Pop, Jazz, Hip Hop, Country, Blues, Classical, Rap, R&B, Metal, Punk, Reggae, Soul, Funk, Disco, Folk, Electronic, EDM, House, Techno, Indie, Gospel, Latin, K-Pop, Opera, Ska, Grunge, Alternative, Dubstep, Trap, Bluegrass, Swing, Reggaeton, Ambient\nband | band, rock band, music group, musical group | Beatles, Rolling Stones, Queen, Led Zeppelin, Pink Floyd, AC/DC, Nirvana, U2, Metallica, Coldplay, Radiohead, Aerosmith, The Who, Eagles, Fleetwood Mac, Guns N' Roses, Green Day, Foo Fighters, Imagine Dragons, Maroon 5, Linkin Park, Red Hot Chili Peppers, Journey, Kiss, Bon Jovi, Van Halen, Pearl Jam, Blink-182, Fall Out Boy, Paramore, BTS, Blackpink, Twenty One Pilots, The Killers, Arctic Monkeys, ABBA, Black Sabbath, Oasis, Genesis, Rush, Boston, Toto\nsinger | singer, pop star, musician, artist, rapper, solo artist | Taylor Swift, Beyonce, Adele, Drake, Eminem, Rihanna, Ed Sheeran, Bruno Mars, Lady Gaga, Ariana Grande, Justin Bieber, Billie Eilish, The Weeknd, Kanye West, Jay-Z, Elvis, Michael Jackson, Madonna, Prince, Whitney Houston, Frank Sinatra, Bob Dylan, Johnny Cash, Katy Perry, Shakira, Selena Gomez, Dua Lipa, Harry Styles, Post Malone, Kendrick Lamar, Snoop Dogg, Lizzo, Olivia Rodrigo, Miley Cyrus, Elton John, Stevie Wonder, Bob Marley, Celine Dion, Mariah Carey, Usher, Nicki Minaj, Travis Scott\nmovie | movie, film, famous movie, blockbuster | Titanic, Avatar, Star Wars, Jaws, Frozen, Shrek, Toy Story, The Godfather, Jurassic Park, Forrest Gump, The Lion King, Inception, Gladiator, Rocky, Alien, E.T., Back to the Future, Ghostbusters, Home Alone, Batman, Spider-Man, Avengers, Matrix, Terminator, Psycho, Casablanca, Grease, Top Gun, Finding Nemo, Up, Coco, Moana, Barbie, Oppenheimer, Joker, Black Panther, Harry Potter, Lord of the Rings, Pulp Fiction, Fight Club, Goodfellas, Scarface, Rambo, Die Hard, Dune, Wicked, Jumanji, Cars, Madagascar, Cinderella\ndisney | disney, disney movie, disney film, disney character, pixar | Mickey Mouse, Minnie Mouse, Donald Duck, Goofy, Pluto, Simba, Nala, Mufasa, Elsa, Anna, Olaf, Moana, Maui, Ariel, Belle, Cinderella, Aurora, Snow White, Jasmine, Aladdin, Mulan, Pocahontas, Rapunzel, Tiana, Woody, Buzz Lightyear, Nemo, Dory, Lightning McQueen, Mater, Stitch, Bambi, Dumbo, Pinocchio, Peter Pan, Tinker Bell, Winnie the Pooh, Baloo, Genie, Hercules, Scar, Ursula, Maleficent, Cruella, Sulley, Mike Wazowski, Wall-E, Remy, Mirabel, Bruno\nsuperhero | superhero, marvel, marvel character, dc, dc character, comic book character, comic character, avenger | Superman, Batman, Spider-Man, Iron Man, Captain America, Thor, Hulk, Black Widow, Hawkeye, Wonder Woman, Flash, Aquaman, Green Lantern, Black Panther, Doctor Strange, Ant-Man, Wolverine, Deadpool, Cyclops, Storm, Rogue, Robin, Batgirl, Supergirl, Captain Marvel, Scarlet Witch, Vision, Falcon, Winter Soldier, Groot, Star-Lord, Gamora, Rocket, Nightwing, Cyborg, Shazam, Daredevil, Punisher, Silver Surfer, Beast, Gambit, Venom, Joker, Thanos, Loki, Lex Luthor\nstar wars | star wars, star wars character | Luke Skywalker, Darth Vader, Yoda, Han Solo, Leia, Chewbacca, Obi-Wan Kenobi, R2-D2, C-3PO, Palpatine, Boba Fett, Jabba the Hutt, Lando, Anakin, Padme, Mace Windu, Darth Maul, Rey, Kylo Ren, Finn, Poe, BB-8, Mandalorian, Grogu, Ahsoka, Count Dooku, General Grievous, Jar Jar Binks, Qui-Gon, Wedge, Admiral Ackbar\nharry potter | harry potter, hogwarts | Harry, Hermione, Ron, Dumbledore, Snape, Voldemort, Hagrid, Draco, Sirius, Neville, Luna, Ginny, Fred, George, McGonagall, Dobby, Bellatrix, Lupin, Cedric, Cho, Moody, Umbridge, Lockhart, Hedwig, Fawkes, Gryffindor, Slytherin, Hufflepuff, Ravenclaw\ncartoon | cartoon, cartoon character, animated character, animation | Bugs Bunny, Daffy Duck, Tom, Jerry, Scooby-Doo, SpongeBob, Patrick, Squidward, Homer Simpson, Bart, Lisa, Marge, Peter Griffin, Stewie, Mickey Mouse, Popeye, Woody Woodpecker, Road Runner, Pink Panther, Garfield, Snoopy, Charlie Brown, Fred Flintstone, George Jetson, Rick, Morty, Bluey, Peppa Pig, Dora, Spongebob, Shrek, Winnie the Pooh, Tweety, Sylvester, Porky Pig, Yogi Bear, Dexter, Johnny Bravo, Finn, Jake, Pikachu, Goku, Naruto, Luffy, Ash, Doraemon, Courage, Arthur, Rugrats, Stimpy\ntv show | tv show, television show, tv series, sitcom, show | Friends, Seinfeld, The Office, Breaking Bad, Game of Thrones, Stranger Things, The Simpsons, Family Guy, South Park, Cheers, Frasier, Lost, The Sopranos, The Wire, Mad Men, Big Bang Theory, How I Met Your Mother, Parks and Recreation, Modern Family, Grey's Anatomy, House, ER, Law & Order, CSI, NCIS, Supernatural, Walking Dead, Dexter, Sherlock, Doctor Who, Squid Game, Wednesday, The Mandalorian, Succession, Ted Lasso, Bluey, SpongeBob, Gilmore Girls, Scrubs, Community, Arrested Development, 30 Rock, Brooklyn Nine-Nine, Survivor, American Idol\nactor | actor, actress, movie star, celebrity, hollywood star | Tom Hanks, Leonardo DiCaprio, Brad Pitt, Johnny Depp, Tom Cruise, Will Smith, Robert De Niro, Al Pacino, Morgan Freeman, Denzel Washington, Meryl Streep, Julia Roberts, Jennifer Lawrence, Scarlett Johansson, Angelina Jolie, Emma Stone, Margot Robbie, Ryan Reynolds, Dwayne Johnson, Keanu Reeves, Harrison Ford, Samuel L. Jackson, Robert Downey Jr., Chris Hemsworth, Chris Evans, Matt Damon, George Clooney, Jack Nicholson, Anthony Hopkins, Nicole Kidman, Sandra Bullock, Zendaya, Timothee Chalamet, Adam Sandler, Jim Carrey, Eddie Murphy, Arnold Schwarzenegger, Sylvester Stallone, Clint Eastwood, Marilyn Monroe\nus president | us president, american president, president | Washington, Lincoln, Jefferson, Roosevelt, Kennedy, Obama, Trump, Biden, Reagan, Nixon, Clinton, Bush, Carter, Truman, Eisenhower, Johnson, Ford, Adams, Jackson, Madison, Monroe, Grant, Hoover, Wilson, Taft, Coolidge, Harding, Garfield, Hayes, Polk, Tyler, Taylor, Fillmore, Pierce, Buchanan, McKinley, Harrison, Cleveland, Arthur, Van Buren, Lincoln\nworld leader | world leader, historical figure, famous person, famous historical figure, famous people | Napoleon, Churchill, Hitler, Stalin, Cleopatra, Julius Caesar, Alexander the Great, Genghis Khan, Gandhi, Mandela, Queen Victoria, Elizabeth, Henry VIII, Joan of Arc, Mao, Lenin, Napoleon Bonaparte, Charlemagne, Attila, Hannibal, Nero, Augustus, King Tut, Ramses, Confucius, Marie Antoinette, Louis XIV, Catherine the Great, Peter the Great, Columbus, Magellan, Marco Polo\nscientist | scientist, inventor, physicist, genius, famous scientist | Einstein, Newton, Darwin, Galileo, Tesla, Edison, Curie, Hawking, Pasteur, Bell, Franklin, Copernicus, Kepler, Faraday, Bohr, Feynman, Turing, Mendel, Fleming, Hubble, Pythagoras, Archimedes, Aristotle, Freud, Oppenheimer, Sagan, Nobel, Wright Brothers, Morse, Ada Lovelace, Maxwell, Planck\npainter artist | painter, famous painter, famous artist, art | Picasso, Van Gogh, Da Vinci, Monet, Rembrandt, Michelangelo, Dali, Warhol, Matisse, Rembrandt, Raphael, Munch, Pollock, Rothko, Cezanne, Renoir, Degas, Manet, Klimt, Frida Kahlo, Banksy, Georgia O'Keeffe, Basquiat, Hopper, Magritte, Gauguin, Botticelli, Vermeer, Goya, Caravaggio\nauthor | author, writer, novelist, famous author, poet | Shakespeare, Dickens, Hemingway, Twain, Austen, Orwell, Tolkien, Rowling, Stephen King, Poe, Fitzgerald, Steinbeck, Tolstoy, Dostoevsky, Homer, Dante, Hugo, Kafka, Wilde, Woolf, Faulkner, Salinger, Dr. Seuss, Roald Dahl, Agatha Christie, Hawthorne, Melville, Whitman, Frost, Angelou, Morrison, Atwood, Asimov, Bradbury, Verne, Wells, Lewis, Collins, Riordan, Suzanne Collins, Brontë, Thoreau, Emerson, Conan Doyle, Kipling\ncar brand | car brand, car company, car maker, car manufacturer, automaker, car | Toyota, Ford, Honda, BMW, Tesla, Audi, Chevrolet, Nissan, Mercedes, Volkswagen, Jeep, Subaru, Mazda, Kia, Hyundai, Dodge, Ferrari, Lamborghini, Porsche, Jaguar, Volvo, Lexus, Cadillac, Chrysler, Buick, GMC, Ram, Mini, Fiat, Bentley, Rolls-Royce, Maserati, Bugatti, Aston Martin, McLaren, Land Rover, Acura, Infiniti, Lincoln, Peugeot, Renault, Suzuki, Mitsubishi, Pontiac, Saturn, Oldsmobile, Plymouth\ncar model | car model, type of car, kind of car | Mustang, Camaro, Corvette, Civic, Corolla, Accord, Camry, Prius, Beetle, Model T, Model S, Model 3, Wrangler, Charger, Challenger, Bronco, Explorer, F-150, Silverado, Tahoe, Focus, Fiesta, Impala, Maverick, Miata, Supra, GT-R, Skyline, Golf, Polo, Cayenne, Cybertruck, Highlander, Tacoma, Tundra, Outback, Forester, RAV4, CR-V\nvehicle | vehicle, transportation, transport, mode of transport, means of transportation | Car, Truck, Bus, Train, Plane, Boat, Bicycle, Motorcycle, Helicopter, Ship, Taxi, Subway, Scooter, Tractor, Ambulance, Van, Skateboard, Tram, Rocket, Submarine, Jet, Canoe, Kayak, Ferry, Limousine, Trolley, Segway, Hovercraft, Sled, Wagon, Jeep, Tank, Hot Air Balloon, Yacht, Raft, Unicycle, Fire Truck\nairline | airline, airplane company, airport | Delta, United, American, Southwest, JetBlue, Alaska, Spirit, Frontier, Emirates, Qantas, Lufthansa, British Airways, Air France, KLM, Ryanair, EasyJet, Air Canada, Singapore Airlines, Qatar, Etihad, Turkish, Cathay Pacific, ANA, Japan Airlines, Hawaiian, Virgin, Aeromexico, LATAM\ntech company | tech company, technology company, tech brand, company, big tech, brand | Apple, Google, Microsoft, Amazon, Meta, Facebook, Tesla, Netflix, Samsung, Intel, IBM, Oracle, Nvidia, Adobe, Sony, Dell, HP, Cisco, Uber, Airbnb, Spotify, Twitter, Snapchat, TikTok, Nintendo, Zoom, PayPal, Salesforce, Twitch, Reddit, OpenAI, Anthropic, AMD, Qualcomm, LinkedIn, Pinterest, Discord, YouTube, Instagram, WhatsApp, Slack, Dropbox, Shopify, Lenovo, Asus, Huawei\nsocial media | social media, social network, app, website, social media app | Facebook, Instagram, Twitter, TikTok, Snapchat, YouTube, Reddit, Pinterest, LinkedIn, WhatsApp, Discord, Twitch, Tumblr, Telegram, Threads, BeReal, Tinder, Facebook, X, Vine, MySpace, Messenger, Signal, WeChat, Bluesky, Mastodon, Quora, Clubhouse\nprogramming language | programming language, coding language, computer language, language code, code | Python, JavaScript, Java, C, C++, C#, Ruby, PHP, Swift, Go, Rust, Kotlin, TypeScript, SQL, HTML, CSS, R, Perl, Scala, Lua, Dart, Haskell, MATLAB, Assembly, COBOL, Fortran, Lisp, Scratch, Bash, Objective-C, Visual Basic, Elixir, Julia\nphone brand | phone brand, phone, smartphone, electronic, gadget, tech | iPhone, Samsung, Google Pixel, Nokia, Motorola, LG, Huawei, OnePlus, Sony, BlackBerry, Xiaomi, Oppo, HTC, Galaxy, Android, iPad, Kindle, Apple Watch, AirPods, MacBook, Chromebook, Surface, GoPro, Fitbit, Alexa, Roomba, Drone, Laptop, Tablet, Camera, Printer, Router\nclothing brand | clothing brand, fashion brand, brand of clothing, clothing company, shoe brand, designer, fashion | Nike, Adidas, Puma, Reebok, Gucci, Prada, Levi's, Gap, Zara, H&M, Uniqlo, Supreme, North Face, Patagonia, Under Armour, Champion, Vans, Converse, New Balance, Lululemon, Calvin Klein, Ralph Lauren, Tommy Hilfiger, Louis Vuitton, Chanel, Versace, Burberry, Hollister, Abercrombie, Old Navy, Forever 21, Fila, Timberland, Dr. Martens, Crocs, Skechers, Hugo Boss, Armani, Balenciaga, Fendi, Dior, Hermes, Carhartt\nclothing | clothing, article of clothing, piece of clothing, clothes, clothing item, outfit, apparel, wear | Shirt, Pants, Shoes, Socks, Hat, Jacket, Dress, Skirt, Jeans, Shorts, Coat, Sweater, Hoodie, Scarf, Gloves, Belt, Tie, Suit, Sneakers, Boots, Sandals, Underwear, T-shirt, Pajamas, Vest, Cardigan, Leggings, Bikini, Swimsuit, Apron, Cape, Poncho, Overalls, Blouse, Tuxedo, Robe, Uniform, Bra, Beanie, Cap\nhat shoe accessory | hat, shoe, accessory, footwear, headwear, type of hat, type of shoe | Sneaker, Boot, Sandal, Loafer, Heel, Slipper, Flip-flop, Cleat, Clog, Moccasin, Baseball Cap, Beanie, Fedora, Top Hat, Cowboy Hat, Beret, Helmet, Crown, Sombrero, Bowler, Visor, Turban, Bucket Hat, Trucker Hat, Wizard Hat, Pumps, Stilettos, Oxford, Brogues\njewelry gem | jewelry, jewellery, gem, gemstone, precious stone, jewel, stone | Diamond, Ruby, Emerald, Sapphire, Pearl, Opal, Amethyst, Topaz, Garnet, Jade, Turquoise, Onyx, Quartz, Amber, Aquamarine, Peridot, Citrine, Moonstone, Ring, Necklace, Bracelet, Earring, Brooch, Pendant, Watch, Tiara, Anklet, Choker, Locket, Cufflinks\nfurniture | furniture, piece of furniture, household furniture, thing in a house, thing in a room, living room, bedroom | Chair, Table, Couch, Bed, Desk, Sofa, Dresser, Bookshelf, Stool, Bench, Cabinet, Wardrobe, Nightstand, Ottoman, Recliner, Futon, Hammock, Rocking Chair, Armchair, Bunk Bed, Crib, Shelf, Drawer, Mirror, Lamp, Rug, Curtain, TV Stand, Coffee Table, Loveseat, Chest, Closet\nkitchen | kitchen, kitchen item, kitchen appliance, cooking tool, thing in a kitchen, utensil, cookware, appliance | Fork, Spoon, Knife, Plate, Bowl, Cup, Pot, Pan, Oven, Stove, Microwave, Refrigerator, Toaster, Blender, Dishwasher, Whisk, Spatula, Ladle, Colander, Kettle, Mixer, Cutting Board, Peeler, Grater, Tongs, Rolling Pin, Can Opener, Measuring Cup, Mug, Glass, Sink, Freezer, Skillet, Wok, Teapot, Coffee Maker, Apron, Oven Mitt, Sieve, Thermos\ntool | tool, hand tool, power tool, thing in a toolbox, garage, hardware, workshop | Hammer, Screwdriver, Wrench, Saw, Drill, Pliers, Chisel, Level, Tape Measure, Axe, Shovel, Rake, Crowbar, Sander, Wrench, Nail, Screw, Bolt, Nut, Ladder, Clamp, Vise, File, Mallet, Hacksaw, Jigsaw, Pickaxe, Hoe, Trowel, Plane, Anvil, Welder, Soldering Iron, Lathe, Router, Wheelbarrow\nroom | room, room in a house, part of a house, part of a building, house | Kitchen, Bedroom, Bathroom, Living Room, Dining Room, Garage, Attic, Basement, Office, Closet, Hallway, Laundry Room, Nursery, Pantry, Porch, Balcony, Den, Library, Foyer, Study, Playroom, Patio, Garden, Cellar, Loft, Sunroom, Mudroom, Garage, Studio, Gym\nschool | school, school subject, class, subject, course, school supply, thing at school, academic | Math, Science, History, English, Art, Music, Biology, Chemistry, Physics, Geography, Gym, Algebra, Geometry, Calculus, Spanish, French, Latin, Literature, Drama, Economics, Psychology, Sociology, Health, Shop, Computer Science, Pencil, Pen, Notebook, Eraser, Ruler, Backpack, Binder, Folder, Marker, Crayon, Scissors, Glue, Calculator, Textbook, Highlighter, Locker, Desk, Chalk, Whiteboard, Stapler\njob | job, occupation, profession, career, worker, position | Doctor, Teacher, Nurse, Lawyer, Chef, Pilot, Farmer, Plumber, Engineer, Artist, Police Officer, Firefighter, Dentist, Electrician, Mechanic, Carpenter, Architect, Accountant, Scientist, Soldier, Baker, Barber, Cashier, Driver, Waiter, Janitor, Writer, Actor, Singer, Athlete, Banker, Judge, Journalist, Programmer, Pharmacist, Veterinarian, Astronaut, Librarian, Mailman, Butcher, Tailor, Fisherman, Miner, Painter, Photographer, Secretary, Manager, Detective, Model\nweapon | weapon, medieval weapon, armor, weapon in a game | Sword, Axe, Bow, Arrow, Spear, Dagger, Shield, Mace, Hammer, Crossbow, Lance, Knife, Gun, Rifle, Pistol, Shotgun, Cannon, Grenade, Bomb, Missile, Katana, Rapier, Club, Whip, Slingshot, Boomerang, Trident, Halberd, Flail, Machete, Musket, Sling, Scythe, Nunchucks, Bazooka, Tank\ncurrency | currency, money, form of money, coin | Dollar, Euro, Pound, Yen, Peso, Rupee, Yuan, Franc, Ruble, Won, Krona, Lira, Real, Dinar, Bitcoin, Cent, Penny, Nickel, Dime, Quarter, Shilling, Rand, Dirham, Baht, Shekel, Krone, Zloty, Forint\nlanguage | language, spoken language, foreign language, world language | English, Spanish, French, German, Chinese, Arabic, Hindi, Russian, Italian, Japanese, Korean, Latin, Portuguese, Greek, Dutch, Swedish, Turkish, Hebrew, Polish, Vietnamese, Thai, Swahili, Persian, Bengali, Urdu, Tagalog, Norwegian, Danish, Finnish, Irish, Welsh, Mandarin, Cantonese\nreligion | religion, god, deity, mythology, myth | Christianity, Islam, Judaism, Hinduism, Buddhism, Sikhism, Taoism, Shinto, Atheism, Zeus, Hera, Poseidon, Athena, Apollo, Artemis, Ares, Hades, Aphrodite, Hermes, Dionysus, Demeter, Hephaestus, Hercules, Thor, Odin, Loki, Freya, Ra, Anubis, Isis, Osiris, Horus, Jupiter, Mars, Venus, Mercury, Neptune, Saturn, Minerva, Cupid\nzodiac | zodiac, zodiac sign, star sign, horoscope, constellation | Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces, Orion, Big Dipper, Ursa Major, Cassiopeia\nmonth | month, month of the year | January, February, March, April, May, June, July, August, September, October, November, December\nday | day, day of the week, weekday | Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday\nseason holiday | season, holiday, celebration, festival, event | Spring, Summer, Fall, Autumn, Winter, Christmas, Halloween, Easter, Thanksgiving, New Year's, Valentine's Day, Independence Day, Fourth of July, Hanukkah, Diwali, Ramadan, Eid, Labor Day, Memorial Day, Mother's Day, Father's Day, St. Patrick's Day, Cinco de Mayo, Kwanzaa, Lunar New Year, Mardi Gras, Groundhog Day, Veterans Day, Black Friday, Birthday, Wedding\ngreek letter | greek letter, greek alphabet, letter | Alpha, Beta, Gamma, Delta, Epsilon, Zeta, Eta, Theta, Iota, Kappa, Lambda, Mu, Nu, Xi, Omicron, Pi, Rho, Sigma, Tau, Upsilon, Phi, Chi, Psi, Omega\nnumber | number, math term, mathematical term, math | One, Two, Three, Four, Five, Six, Seven, Eight, Nine, Ten, Eleven, Twelve, Twenty, Hundred, Thousand, Million, Billion, Zero, Pi, Sum, Product, Fraction, Decimal, Equation, Angle, Radius, Diameter, Integer, Prime, Factor, Variable, Exponent, Percent, Triangle\nweather | weather, weather condition, natural disaster, disaster, storm | Rain, Snow, Sun, Wind, Cloud, Storm, Thunder, Lightning, Fog, Hail, Sleet, Tornado, Hurricane, Blizzard, Drought, Flood, Earthquake, Tsunami, Volcano, Avalanche, Wildfire, Typhoon, Cyclone, Heat Wave, Rainbow, Frost, Mist, Breeze, Monsoon, Landslide\nbuilding | building, landmark, famous landmark, structure, wonder, famous building, tourist attraction | Eiffel Tower, Big Ben, Statue of Liberty, Colosseum, Taj Mahal, Great Wall, Pyramids, Empire State Building, Golden Gate Bridge, White House, Buckingham Palace, Leaning Tower of Pisa, Sydney Opera House, Mount Rushmore, Stonehenge, Machu Picchu, Burj Khalifa, Space Needle, Parthenon, Sagrada Familia, Kremlin, Louvre, Niagara Falls, Grand Canyon, CN Tower, Petra, Angkor Wat, Alcatraz, Hollywood Sign, Times Square, Arc de Triomphe, Brooklyn Bridge, Tower Bridge\nstore shop | store, shop, retailer, supermarket, grocery store, place to shop, place | Walmart, Target, Costco, Amazon, Walgreens, CVS, Kroger, Home Depot, Lowe's, Best Buy, IKEA, Aldi, Trader Joe's, Whole Foods, Safeway, 7-Eleven, Dollar Tree, Macy's, Kohl's, Sears, Nordstrom, Barnes & Noble, GameStop, Staples, Petco, Sephora, Ulta, TJ Maxx, Marshalls, Publix, Wegmans, Sam's Club, Toys R Us, Radio Shack, Blockbuster\ntoy | toy, kid's toy, childhood toy, plaything | Lego, Barbie, Hot Wheels, Teddy Bear, Doll, Yo-Yo, Slinky, Rubik's Cube, Play-Doh, Nerf, Action Figure, Frisbee, Kite, Jump Rope, Marbles, Puzzle, Blocks, Etch A Sketch, Furby, Tamagotchi, Beyblade, Fidget Spinner, Water Gun, Rocking Horse, Train Set, Toy Car, Jack-in-the-Box, Hula Hoop, Pogo Stick, Bouncy Ball, Tonka Truck, Cabbage Patch Kid, Tickle Me Elmo, Beanie Baby, Magic 8 Ball, Silly Putty\ntv character | sesame street, muppet, kids show, nickelodeon, nick, cartoon network | Elmo, Big Bird, Cookie Monster, Oscar the Grouch, Bert, Ernie, Kermit, Miss Piggy, Fozzie, Gonzo, Count von Count, Grover, Abby Cadabby, Dora, Diego, Blue, SpongeBob, Patrick Star, Squidward, Mr. Krabs, Sandy, Plankton, Gary, Arnold, Doug, Rocko, Angelica, Tommy Pickles, Timmy Turner, Jimmy Neutron, Danny Phantom, Aang, Katara, Zuko, Toph, Sokka\nholiday food | christmas, thanksgiving, halloween, easter, holiday item, holiday thing | Turkey, Stuffing, Cranberry Sauce, Pumpkin Pie, Mashed Potatoes, Gravy, Candy Cane, Eggnog, Gingerbread, Fruitcake, Christmas Tree, Santa, Reindeer, Rudolph, Elf, Snowman, Stocking, Ornament, Wreath, Mistletoe, Pumpkin, Ghost, Witch, Skeleton, Candy Corn, Costume, Trick or Treat, Easter Bunny, Easter Egg, Jelly Beans, Chocolate Bunny, Basket\nafrican country | african country, country in africa, africa country, africa | Egypt, Nigeria, South Africa, Kenya, Ethiopia, Morocco, Ghana, Algeria, Tanzania, Uganda, Sudan, Libya, Tunisia, Senegal, Zimbabwe, Zambia, Angola, Mozambique, Madagascar, Cameroon, Ivory Coast, Namibia, Botswana, Somalia, Rwanda, Mali, Niger, Chad, Congo, Gabon, Liberia, Sierra Leone, Malawi, Eritrea, Togo, Benin, Mauritius\neuropean country | european country, country in europe, europe country, europe | France, Germany, Italy, Spain, United Kingdom, Poland, Ukraine, Greece, Portugal, Sweden, Norway, Denmark, Finland, Ireland, Netherlands, Belgium, Switzerland, Austria, Hungary, Romania, Czech Republic, Croatia, Serbia, Bulgaria, Iceland, Slovakia, Slovenia, Estonia, Latvia, Lithuania, Luxembourg, Malta, Albania, Belarus, Moldova, Monaco\nasian country | asian country, country in asia, asia country, asia | China, India, Japan, South Korea, Thailand, Vietnam, Indonesia, Philippines, Malaysia, Singapore, Pakistan, Bangladesh, Nepal, Sri Lanka, Cambodia, Laos, Myanmar, Mongolia, Kazakhstan, Iran, Iraq, Israel, Saudi Arabia, Turkey, Afghanistan, Taiwan, Bhutan, Jordan, Lebanon, Syria, Yemen, Oman, Qatar, Kuwait, Uzbekistan\nsouth american country | south american country, country in south america, south america | Brazil, Argentina, Chile, Peru, Colombia, Venezuela, Ecuador, Bolivia, Paraguay, Uruguay, Guyana, Suriname\nrapper | rapper, hip hop artist, rap artist, hip hop | Eminem, Drake, Kendrick Lamar, Jay-Z, Kanye West, Snoop Dogg, Tupac, Notorious B.I.G., Nas, 50 Cent, Lil Wayne, Travis Scott, Post Malone, Nicki Minaj, Cardi B, Dr. Dre, Ice Cube, Lil Nas X, J. Cole, Future, Migos, Tyler the Creator, A$AP Rocky, Megan Thee Stallion, Ludacris, Missy Elliott, LL Cool J, Wiz Khalifa, Childish Gambino, Juice WRLD, XXXTentacion, 21 Savage, Lil Baby, DaBaby, Run DMC, Public Enemy\nprincess | princess, disney princess | Cinderella, Snow White, Aurora, Ariel, Belle, Jasmine, Pocahontas, Mulan, Tiana, Rapunzel, Merida, Moana, Elsa, Anna, Raya, Mirabel, Sleeping Beauty, Tinker Bell, Leia, Peach, Zelda, Fiona, Daisy, Rosalina\nnintendo console | nintendo console, nintendo system, nintendo | Nintendo Switch, Wii, Game Boy, NES, SNES, Nintendo 64, GameCube, DS, 3DS, Wii U, Game Boy Advance, Game Boy Color, Virtual Boy, Switch Lite, Switch 2, Famicom, Game & Watch, New 3DS\nbed | bed, type of bed, mattress, sleeping | Bunk Bed, Twin, Full, Queen, King, California King, Futon, Waterbed, Cot, Crib, Daybed, Hammock, Sofa Bed, Murphy Bed, Canopy Bed, Four-Poster, Trundle Bed, Loft Bed, Platform Bed, Air Mattress, Sleeping Bag, Bassinet, Hospital Bed, Twin XL, Adjustable Bed, Sleigh Bed, Cradle, Pallet, Bedroll, Tatami\nchair | chair, seat, type of chair, seating | Rocking Chair, Recliner, Armchair, Stool, Bench, Throne, Beanbag, Office Chair, Folding Chair, High Chair, Barstool, Wheelchair, Lawn Chair, Deck Chair, Dining Chair, Swivel Chair, Wingback, Loveseat, Sofa, Couch, Ottoman, Pew, Director's Chair, Electric Chair, Papasan, Chaise Lounge, Bleacher, Booster Seat, Rocker\ntable | table, type of table, desk | Coffee Table, Dining Table, End Table, Desk, Picnic Table, Nightstand, Side Table, Kitchen Table, Card Table, Folding Table, Pool Table, Ping Pong Table, Conference Table, Workbench, Vanity, Console Table, Round Table, Drafting Table, Changing Table, Altar, Counter, Bar\nboat | boat, ship, watercraft, vessel, type of boat, type of ship | Sailboat, Canoe, Kayak, Yacht, Ferry, Submarine, Speedboat, Rowboat, Cruise Ship, Tugboat, Raft, Gondola, Barge, Catamaran, Dinghy, Fishing Boat, Battleship, Aircraft Carrier, Pontoon, Jet Ski, Steamboat, Lifeboat, Viking Ship, Galleon, Schooner, Clipper, Trawler, Hovercraft, Junk, Dhow, Paddleboat, Frigate, Destroyer\nplane | plane, aircraft, airplane, type of plane, flying machine | Jet, Helicopter, Glider, Biplane, Seaplane, Fighter Jet, Bomber, Boeing 747, Airbus, Cessna, Concorde, Stealth Bomber, Drone, Blimp, Zeppelin, Hot Air Balloon, Space Shuttle, Rocket, Propeller Plane, Cargo Plane, Jumbo Jet, Spitfire, F-16, Harrier, Osprey, Learjet, Paraglider, Hang Glider, Gyrocopter\nhouse | house, type of house, home, dwelling, building type, place to live | Mansion, Cabin, Cottage, Apartment, Condo, Townhouse, Bungalow, Castle, Igloo, Tent, Treehouse, Mobile Home, Villa, Duplex, Penthouse, Ranch, Farmhouse, Hut, Palace, Tipi, Yurt, Trailer, Dorm, Loft, Shack, Chalet, Houseboat, Lighthouse, Barn, Skyscraper, Hotel, Motel, Studio, Brownstone, Split-Level\npizza | pizza, pizza topping, pizza type, pizza style | Pepperoni, Cheese, Sausage, Mushroom, Onion, Olive, Pineapple, Bacon, Ham, Green Pepper, Margherita, Hawaiian, Supreme, Meat Lovers, Veggie, BBQ Chicken, Buffalo Chicken, Anchovy, Spinach, Tomato, Chicago Style, New York Style, Deep Dish, Calzone, Stromboli, Sicilian, Neapolitan, Thin Crust, Stuffed Crust\nsandwich | sandwich, sandwich type, burger, hot dog | Hamburger, Cheeseburger, BLT, Club, Grilled Cheese, PB&J, Sub, Hoagie, Reuben, Panini, Wrap, Gyro, Burrito, Taco, Hot Dog, Philly Cheesesteak, Po' Boy, Sloppy Joe, Gyro, Banh Mi, Croque Monsieur, Monte Cristo, Tuna Melt, Ham and Cheese, Turkey Club, Falafel, Cuban, Muffuletta, Patty Melt, Bagel Sandwich\nsoup salad sauce | soup, salad, sauce, condiment, dressing, dip | Chicken Noodle, Tomato, Clam Chowder, Minestrone, French Onion, Miso, Ramen, Pho, Gazpacho, Caesar, Cobb, Greek, Coleslaw, Ketchup, Mustard, Mayonnaise, Ranch, BBQ Sauce, Hot Sauce, Soy Sauce, Salsa, Guacamole, Hummus, Pesto, Alfredo, Marinara, Tartar Sauce, Teriyaki, Sriracha, Vinaigrette, Italian, Blue Cheese, Honey Mustard, Thousand Island, Relish, Wasabi, Gravy, Tzatziki\negg breakfast | egg, breakfast, breakfast food, morning food | Scrambled Eggs, Fried Eggs, Omelet, Boiled Eggs, Poached Eggs, Pancakes, Waffles, French Toast, Bacon, Sausage, Hash Browns, Toast, Cereal, Oatmeal, Bagel, Yogurt, Granola, Eggs Benedict, Muffin, Biscuits and Gravy, Breakfast Burrito, Grits, Croissant, Donut, Sunny Side Up, Over Easy, Frittata, Quiche, Home Fries\nice cream flavor | ice cream, ice cream flavor, flavor, flavour | Vanilla, Chocolate, Strawberry, Cookie Dough, Mint Chocolate Chip, Rocky Road, Cookies and Cream, Butter Pecan, Neapolitan, Coffee, Pistachio, Rainbow Sherbet, Cotton Candy, Birthday Cake, Salted Caramel, Moose Tracks, Cherry Garcia, Peanut Butter, Mango, Coconut, Lemon, Raspberry, Bubble Gum, Fudge Ripple, Tutti Frutti, Chocolate Chip, Pralines and Cream, Black Cherry, Banana, Maple Walnut, Peppermint\ncake pie cookie | cake, pie, cookie, biscuit, type of cake, type of pie, type of cookie | Chocolate Chip, Oatmeal Raisin, Sugar Cookie, Snickerdoodle, Peanut Butter, Oreo, Shortbread, Gingerbread, Macaroon, Biscotti, Apple Pie, Pumpkin Pie, Cherry Pie, Pecan Pie, Key Lime, Lemon Meringue, Blueberry Pie, Sweet Potato Pie, Red Velvet, Carrot Cake, Angel Food, Pound Cake, Funfetti, Bundt, Black Forest, Cheesecake, Coffee Cake, Fruitcake, Lava Cake, Cupcake, Shortcake, Upside-Down Cake\ntea juice | tea, juice, type of tea, type of juice | Green Tea, Black Tea, Earl Grey, Chamomile, Oolong, Peppermint, Chai, Matcha, Jasmine, English Breakfast, Rooibos, Herbal Tea, Iced Tea, Sweet Tea, Bubble Tea, Orange Juice, Apple Juice, Grape Juice, Cranberry Juice, Tomato Juice, Pineapple Juice, Grapefruit Juice, Lemonade, Prune Juice, Pomegranate Juice, Carrot Juice, Lemon, Kombucha\nknife sword | knife, sword, blade, type of knife, type of sword | Katana, Rapier, Broadsword, Saber, Scimitar, Claymore, Cutlass, Machete, Dagger, Switchblade, Bowie Knife, Pocket Knife, Butter Knife, Steak Knife, Chef's Knife, Paring Knife, Bread Knife, Cleaver, Swiss Army Knife, Longsword, Epee, Foil, Excalibur, Lightsaber, Sabre, Zweihander, Gladius, Kukri, Dirk, Stiletto, Samurai Sword\nbridge tower | bridge, tower, type of bridge | Golden Gate, Brooklyn Bridge, Tower Bridge, London Bridge, Rialto, Sydney Harbour Bridge, Ponte Vecchio, Suspension, Drawbridge, Arch, Covered Bridge, Cantilever, Beam, Truss, Pontoon, Rope Bridge, Footbridge, Viaduct, Aqueduct, Cable-Stayed, Swing Bridge, Bascule, Overpass, Eiffel Tower, CN Tower, Space Needle, Tokyo Tower, Big Ben, Leaning Tower of Pisa, Burj Khalifa\nphobia fear | phobia, fear, afraid of, scary | Spiders, Snakes, Heights, Clowns, Darkness, Flying, Needles, Public Speaking, Death, Germs, Water, Dogs, Closed Spaces, Crowds, Blood, Thunder, Fire, Dentist, Failure, Ghosts, Sharks, Insects, Mice, Bats, Elevators, Birds, Open Spaces, Bridges, Storms, Vomiting\nemotion feeling | emotion, feeling, mood, personality trait, trait, adjective | Happy, Sad, Angry, Scared, Excited, Nervous, Proud, Jealous, Lonely, Anxious, Calm, Bored, Confused, Embarrassed, Grateful, Hopeful, Surprised, Disgusted, Joy, Love, Fear, Rage, Guilt, Shame, Relief, Curious, Kind, Brave, Funny, Smart, Shy, Lazy, Honest, Loyal, Generous, Patient, Stubborn\nnoise sound | noise, sound, sound effect, animal sound, onomatopoeia | Bang, Boom, Crash, Buzz, Meow, Woof, Moo, Oink, Quack, Roar, Hiss, Beep, Ring, Pop, Click, Thud, Splash, Whisper, Scream, Giggle, Sneeze, Cough, Honk, Tweet, Neigh, Baa, Cluck, Ribbit, Squeak, Growl, Purr, Howl, Zoom, Sizzle, Ding, Clap, Snap, Slam, Whoosh, Thunder";
/*@@DATA_END@@*/

const STOP = new Set("the a an in of that is are you can find name type kind some any different popular thing from to by on at and or for with which what who whose lives live someone something one famous common good best".split(" "));
function stem(w) {
  if (w.length > 3 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && /(ss|us|is)$/.test(w)) return w;
  if (w.length > 3 && /(ch|sh|x|s)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}
const norm = (t) => t.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).map(stem);

const CATEGORIES = DATA.split("\n").filter(Boolean).map((line) => {
  const [name, aliases, items] = line.split(" | ");
  return { name, aliases: aliases.split(",").map((x) => norm(x)).filter((x) => x.length), items: items.split(",").map((x) => x.trim()).filter(Boolean) };
});

// Best built-in category for a prompt: an alias appearing as a phrase beats an alias whose words are just all present.
function matchCategory(prompt) {
  const words = norm(prompt);
  const text = " " + words.join(" ") + " ";
  let best = null, bestScore = 0;
  for (const c of CATEGORIES) {
    for (const al of c.aliases) {
      let score = 0;
      if (text.includes(" " + al.join(" ") + " ")) score = 12 * al.length;
      else if (al.length > 1 && al.every((w) => words.includes(w))) score = 10 * al.length;
      if (score > bestScore) { bestScore = score; best = c; }
    }
  }
  return best;
}

// "Name types of cheese?" -> "cheese"
function topicOf(prompt) {
  prompt = prompt.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const lead = /^(please|name|list|say|give me|tell me|famous|some|any|different|popular|types? of|kinds? of|things|which|what are|what is|a|an|the)\s+/;
  let t = prompt.toLowerCase().replace(/[?!.:]+$/g, "").trim();
  for (let prev; prev !== t; ) { prev = t; t = t.replace(lead, ""); }
  return t;
}

function singular(w) {
  return w.replace(/ies$/, "y").replace(/(s|x|ch|sh)es$/, "$1").replace(/s$/, "");
}

function clean(title) {
  return title.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

// A Wikipedia category/list title must mention every word of the topic, or it's some unrelated page.
function titleMatches(title, topic) {
  const t = new Set(norm(title.replace(/^(category|list of|lists of):?\s*/i, "")));
  return norm(topic).every((w) => t.has(w));
}

function usable(title) {
  return (
    title &&
    !/^(list|lists|category|template|portal|wikipedia|help|file|outline|index|glossary|timeline)\b/i.test(title) &&
    !/\b(list of|lists of)\b/i.test(title) &&
    !/^\d/.test(title) &&
    title.length <= 30
  );
}

function wiki(params) {
  return getJSON(`${WIKI}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`);
}

// Orders titles by recent pageviews, so well-known answers come before obscure ones.
async function byPopularity(titles) {
  const views = new Map();
  const batches = [];
  for (let i = 0; i < titles.length; i += 50) batches.push(titles.slice(i, i + 50));
  const results = await Promise.all(
    batches.map((batch) => wiki({ action: "query", prop: "pageviews", pvipdays: "30", titles: batch.join("|") }).catch(() => null))
  );
  for (const r of results) {
    for (const p of Object.values(r?.query?.pages || {})) {
      views.set(p.title, Object.values(p.pageviews || {}).reduce((sum, v) => sum + (v || 0), 0));
    }
  }
  return [...titles].sort((a, b) => (views.get(b) || 0) - (views.get(a) || 0));
}

async function fromCategory(topic) {
  const s = await wiki({ action: "query", list: "search", srsearch: topic, srnamespace: "14", srlimit: "3" });
  const lists = await Promise.all(
    (s.query?.search || []).filter((hit) => titleMatches(hit.title, topic)).map((hit) =>
      wiki({ action: "query", list: "categorymembers", cmtitle: hit.title, cmtype: "page", cmlimit: "150" }).catch(() => null)
    )
  );
  for (const m of lists) {
    const titles = (m?.query?.categorymembers || []).map((p) => p.title).filter((t) => usable(clean(t)));
    if (titles.length >= 5) return (await byPopularity(titles)).map(clean);
  }
  return [];
}

async function fromListPage(topic) {
  const s = await wiki({ action: "query", list: "search", srsearch: `List of ${topic}`, srlimit: "5" });
  const page = (s.query?.search || []).map((x) => x.title).find((t) => titleMatches(t, topic));
  if (!page) return [];
  const l = await wiki({ action: "query", prop: "links", titles: page, pllimit: "100", plnamespace: "0" });
  const pages = Object.values(l.query?.pages || {});
  const titles = (pages[0]?.links || []).map((x) => x.title).filter((t) => usable(clean(t)));
  return (await byPopularity(titles)).map(clean);
}

// Datamuse (free, no key): words that are kinds of the given word, e.g. "cheese" -> cheddar, brie...
async function fromDatamuse(word) {
  const rows = await getJSON(`https://api.datamuse.com/words?rel_gen=${encodeURIComponent(word)}&max=100&md=f`);
  const freq = (r) => parseFloat((r.tags || []).find((t) => t.startsWith("f:"))?.slice(2)) || 0;
  return rows
    .filter((r) => /^[a-z][a-z' -]{2,}$/i.test(r.word))
    .sort((a, b) => freq(b) - freq(a)) // everyday words first
    .map((r) => r.word.replace(/^./, (c) => c.toUpperCase()));
}

// "animal that lives in the ocean" -> ["animal that lives in the ocean", "animal", "ocean", ...]
function variants(topic) {
  const words = topic.split(/\s+/).filter((w) => !/^(in|of|the|that|which|who|a|an|and|or|on|at|to|from|with|you|can|find|found|lives?)$/.test(w));
  const out = [topic, singular(topic)];
  if (words.length > 1) out.push(words.join(" "), words.slice(-2).join(" "), words[words.length - 1], words[0]);
  out.push(...words.map(singular));
  return [...new Set(out.filter(Boolean))];
}

// Built-in lists answer instantly. Only categories with no built-in list go to the (slower, rougher) web lookup.
async function candidates(topic, onPartial) {
  const cacheKey = `cache3:${topic}`;
  let web = GM_getValue(cacheKey);
  if (!web) {
    // Every variant and source runs at once. The best-ranked variant wins, and within it the best source
    // with enough answers (Wikipedia category, then list page, then word database). Sources are not mixed.
    let lastError;
    const runs = variants(topic).map((v) =>
      Promise.all([fromCategory, fromListPage, fromDatamuse].map((src) => src(v).catch((e) => { lastError = e; return []; })))
    );
    web = [];
    for (const run of runs) {
      const found = (await run).find((n) => n.length >= 5);
      if (found) { web = [...new Set(found)]; break; }
    }
    if (!web.length && lastError) throw lastError;
    web = web.slice(0, 200);
    if (web.length) GM_setValue(cacheKey, web);
  }
  return web;
}

async function suggest(prompt, onPartial) {
  const cat = matchCategory(prompt);
  if (cat) return { answers: cat.items, topic: cat.name, source: "built-in" };
  const topic = topicOf(prompt);
  if (!topic) throw new Error("Couldn't work out the category.");
  const answers = await candidates(topic, () => {});
  if (!answers.length) throw new Error(`No answers found for "${topic}".`);
  return { answers, topic, source: "web, may be rough" };
}

// Detects the Puffer Party category prompt, asks the background worker for answers, and shows them in a sidebar.
// The sidebar only appears while a "CATEGORY n" prompt is on screen.
(() => {
  try { localStorage.removeItem("puffer-helper-selector"); } catch (_) {}

  const HOST = document.createElement("div");
  HOST.style.cssText = "position:fixed;top:110px;left:12px;z-index:2147483647;display:none;";
  const root = HOST.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      .box{width:210px;max-height:80vh;overflow:auto;font:13px ui-monospace,monospace;color:#e8f6ff;background:#0a2a45ee;border:1px solid #3cc8ff;border-radius:8px;padding:8px}
      .row{display:flex;justify-content:space-between;align-items:center;gap:6px}
      .p{margin:6px 0;color:#7fd8ff;word-break:break-word}
      button{font:inherit;background:#12466e;color:inherit;border:1px solid #3cc8ff;border-radius:4px;padding:2px 6px;cursor:pointer}
      .a{display:block;width:100%;text-align:left;margin:3px 0}
      .a.top{background:#1f7a4d}
      .t{color:#9bb;font-size:11px;margin-bottom:4px}
      .err{color:#ff9a9a}
    </style>
    <div class="box">
      <div class="row"><b>Puffer helper</b><button id="min">_</button></div>
      <div id="body"><div class="p" id="prompt"></div><div id="out"></div></div>
    </div>`;
  document.documentElement.appendChild(HOST);
  const $ = (id) => root.getElementById(id);

  const LABEL = /^category\s*\d+$/i;
  const HINT = /any answer passes the puffer/i;
  const IGNORE = /^(any answer|category|unrated|floating)/i;
  const clip = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
  const fontOf = (el) => parseFloat(getComputedStyle(el).fontSize) || 0;
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

  // Anchors: the small "CATEGORY n" label, or the "any answer passes the puffer" hint. Text may be split across
  // child elements (typewriter effects), so match on an element's whole text, deepest match first.
  function anchors() {
    const found = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (HOST.contains(el) || el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
      const t = clip(el);
      if (t.length > 40 || !t) continue;
      if (!(LABEL.test(t) || HINT.test(t)) || !visible(el)) continue;
      if ([...el.children].some((c) => LABEL.test(clip(c)) || HINT.test(clip(c)))) continue; // deeper match wins
      found.push(el);
    }
    return found;
  }

  // The prompt is the largest text sharing a container (up to 4 levels up) with an anchor.
  function detectPrompt() {
    let best = "", bestFont = 0;
    for (const anchor of anchors()) {
      let box = anchor.parentElement;
      for (let i = 0; i < 4 && box && !best; i++, box = box.parentElement) {
        let pick = null;
        for (const n of box.querySelectorAll("*")) {
          if (HOST.contains(n) || !visible(n)) continue;
          const t = clip(n);
          if (t.length < 8 || t.length > 120 || IGNORE.test(t) || n.contains(anchor)) continue;
          const f = fontOf(n);
          // largest font wins; among equals, the tightest element (shortest text) is the prompt itself
          if (!pick || f > pick.f || (f === pick.f && t.length < pick.t.length)) pick = { f, t };
        }
        if (pick && pick.f > fontOf(anchor) && pick.f > bestFont) { best = pick.t; bestFont = pick.f; }
      }
    }
    return best;
  }

  // Click the dot (bottom-left) to copy a description of the page; useful when detection misses.
  const dot = document.createElement("div");
  dot.title = "Puffer helper is running. Click to copy debug info.";
  dot.style.cssText = "position:fixed;bottom:6px;left:6px;width:10px;height:10px;border-radius:50%;background:#3cc8ff;opacity:.5;cursor:pointer;z-index:2147483647";
  dot.onclick = () => {
    const lines = [location.href, "anchors: " + anchors().length, "prompt: " + detectPrompt(), ""];
    for (const el of document.body.querySelectorAll("*")) {
      const t = clip(el);
      if (HOST.contains(el) || el.dataset?.pufferDot || !t || t.length > 80 || !visible(el)) continue;
      lines.push(`<${el.tagName.toLowerCase()} children=${el.children.length} font=${fontOf(el)}> ${t}`);
    }
    navigator.clipboard.writeText(lines.slice(0, 150).join("\n")).then(() => { dot.style.background = "#4f4"; setTimeout(() => (dot.style.background = "#3cc8ff"), 1500); });
  };
  dot.dataset.pufferDot = "1";
  document.documentElement.appendChild(dot);

  // Every short piece of text that appears on the page this round (answer bubbles, chat) is remembered,
  // so an answer still counts as used after its bubble disappears.
  let seen = new Set();
  const note = (text) => {
    const t = (text || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (t && t.length <= 40 && !(current && t.includes(current.toLowerCase()))) seen.add(t);
  };
  function noteTree(node) {
    if (node.nodeType === 3) return note(node.nodeValue);
    if (node.nodeType !== 1) return;
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) note(n.nodeValue);
  }
  function onScreenText() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) note(n.nodeValue);
  }
  const esc = (a) => a.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const isUsed = (a) => {
    const re = new RegExp(`(^|[^a-z])${esc(a)}(e?s)?([^a-z]|$)`);
    for (const t of seen) if (re.test(t)) return true;
    return false;
  };

  let current = "";
  let all = [];
  let topic = "";
  let clicked = new Set();

  function render(error) {
    const out = $("out");
    out.textContent = "";
    if (error) { const d = document.createElement("div"); d.className = "err"; d.textContent = error; out.append(d); return; }
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = "searched: " + topic;
    out.append(t);
    const left = all.filter((a) => !clicked.has(a) && !isUsed(a)).slice(0, 40);
    left.forEach((a, i) => {
      const b = document.createElement("button");
      b.className = "a" + (i === 0 ? " top" : "");
      b.textContent = a;
      b.onclick = () => { navigator.clipboard?.writeText(a); clicked.add(a); render(); };
      out.append(b);
    });
    if (!left.length) out.append(Object.assign(document.createElement("div"), { className: "err", textContent: "nothing left" }));
  }

  async function refresh() {
    const p = detectPrompt();
    HOST.style.display = p ? "" : "none";
    if (!p) { current = ""; return; }
    if (p === current) { if (all.length) render(); return; } // re-filter as new answers appear on screen
    current = p; all = []; clicked = new Set(); seen = new Set();
    onScreenText();
    $("prompt").textContent = p;
    $("out").textContent = "thinking...";
    const res = await suggest(p, (part) => {
      if (p !== current) return;
      all = part.answers; topic = part.topic;
      render();
    }).catch((e) => ({ error: String(e.message || e) }));
    if (p !== current) return; // prompt changed while waiting
    if (res.error) return render(res.error);
    all = res.answers; topic = res.topic + " (" + res.source + ")";
    render();
  }

  let timer;
  let last = 0;
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData") note(m.target.nodeValue);
      else m.addedNodes.forEach(noteTree);
    }
    if (timer) return;
    timer = setTimeout(() => { timer = 0; last = Date.now(); refresh(); }, Math.max(300, 800 - (Date.now() - last)));
  })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  refresh();

  $("min").onclick = () => { const b = $("body"); b.style.display = b.style.display === "none" ? "" : "none"; };
})();

})();
