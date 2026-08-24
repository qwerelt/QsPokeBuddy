This describes all views of the bip6 companion app, their components and navigation within the app.
All positions are described with coordination x = 0, y = 0 in the top left corner

# Struture
The app is made from 3 different views: Main, Tasks, Reward.

## Navigation
The app opens on a Main view. Swiping up reveals a Reward view. Swiping down on reward view returns to the Main view. Main view has a "Tasks" button which uppon clicking takes user to Tasks view. Swiping back (right) on Tasks view returns to the main screen.

# Views
Describing specific views and their components.

## Shared Components
Components with prefix 'component_shared' are shared across all the views.

Component: Edge - Top
    File: @component_shared_edge_top.png
    Top-Left: (x: 0, y: 60)
    Size: 390 x 90

Component: Edge - Bot
    File: @_component_shared_edge__bot.png
    Top-Left: 
        Main view: (x: 0, y:360)
        Reward view: (x:0, y:360)
        Tasks view: 
            If list is 3 tasks and longer: bottom of the list, stoping when reaching (x: 0, y: 360)
            if list is less then 3 tasks: (x: 0, y: 360)
    Size: 390 x 90

Component: Background
    File: @component_shared_background.png
    Top-left: (x: 0, y: 60)
    Size: 390 x 390
    Note: Can be exchanged for static background color HTML notation: #ffebbb

## Main View
Components with prefix 'component_main'. The example of a view is at file @pokebuddy_main.png 
Components are described in order from back to front.

Main view has 2 interactive components:
    Task button (described bellow)
    Swiping up

Component: Task button
    File: @component_main_task.png
    Top-left: (x: 10, y: 280)
    Size: 370 x 120
    Function: Navigation to 'Tasks' view

Component: Devider
    File: @component_main_devider.png
    Top-left: (x: 0, y: 240)
    Size: 390 x 30

Component: Shadow
    File: @component_main_shadow.png
    Top-left: (x: 35, y: 185)
    Size: 96 x 35

Component: Pokemon Sprite
    File: obtained from phone app
    Max-size: 96 x 96
    Center: (x: 83, y: 173)
    Note: At max size the center coresponds to Top-left: (x: 35, y: 125)

Component: Name tag
    File: @component_main_tag.png
    Top-left: (x: 250, y: 130)
    Size: 130 x 40
    Text: "pokemon_name"
        Font: Eurostile ExtendedTwo Regular
        Font-size: 30
        Font-color: white
        Font-relative-position: Centered
        Font-file: @Eurostile-ExtendedTwo.otf
    Note: "pokemon_name" is obtained from phone app

Component: Lvl tag
    File: @component_main_tag.png
    Top-left: (x: 250, y: 180)
    Size: 130 x 40
    Size: 130 x 40
    Text: 'lvl ' + "pokemon_lvl"
        Font: Eurostile ExtendedTwo Regular
        Font-size: 30
        Font-color: white
        Font-relative-position: Centered
        Font-file: @Eurostile-ExtendedTwo.otf
    Note: "pokemon_lvl" is obtained from phone app

Component: Exp bar
    Top-left: (x: 11, y: 251)
    Height: 8px
    Max-width: 368px
    Color: #15ee9d
    Note: Shows progress of exp needed for next lvlup. Exp info obtained from phone app.

## Reward View
Reward view has 6 buttons and one info component. Each button gives pokemon +1 in specific EV.
Clicking buttons triggers a popup informing user about adding +1 to specific EV.

Component: Info
    File: @component_reward_info.png
    Top-left: (x: 135, y: 190)
    Size: 120 x 120
    Opacity: 70%

Component: HP button
    File: @component_reward_hp.png
    Top-left: (x: 30, y: 130)
    Size: 60 x 60
    Note: Upon clicking adds +1 to HP EV

Component: Atk button
    File: @component_reward_atk.png
    Top-left: (x: 30, y: 220)
    Size: 60 x 60
    Note: Upon clicking adds +1 to Atk EV

Component: Def button
    File: @component_reward_def.png
    Top-left: (x: 30, y: 310)
    Size: 60 x 60
    Note: Upon clicking adds +1 to Def EV

Component: SpA button
    File: @component_reward_spa.png
    Top-left: (x: 300, y: 130)
    Size: 60 x 60
    Note: Upon clicking adds +1 to SpA EV

Component: SpD button
    File: @component_reward_spd.png
    Top-left: (x: 300, y: 220)
    Size: 60 x 60
    Note: Upon clicking adds +1 to SpD EV

Component: Spe button
    File: @component_reward_spe.png
    Top-left: (x: 300, y: 310)
    Size: 60 x 60
    Note: Upon clicking adds +1 to Spe EV

## Task View
Reward view has X buttons. X is a number of active tasks. List of active task is provided by the mobile app. The number of tasks dictates location of shared component "Edge - Bot". Edge bot is never higher then Top-left: (x: 0, y: 360)
Every task has 3 text properties: task_name, task_tag, task_reward

Shared properties:
    Size: 360 x 90
    Spacing-between-tasks: 10px
    Text:
        'task_name': Obtained from phone app.
            Font: Eurostile ExtendedTwo Regular
            Font-size: 25
            Font-color: white
            Font-relative-position: Centered
            Font-file: @Eurostile-ExtendedTwo.otf
            Position:
                Horizontal: Center on x: 195
                Vertical: Top-left + 15px
        'task_tag': Obtained from phone app.
            Font: Eurostile ExtendedTwo Regular
            Font-size: 25
            Font-color: #707070
            Font-relative-position: Centered
            Font-file: @Eurostile-ExtendedTwo.otf
            Position:
                Horizontal: Center on x: 105
                Vertical: Top-left + 50px 
        'task_reward': Obtained from phone app.
            Font: Eurostile ExtendedTwo Regular
            Font-size: 25
            Font-color: #707070
            Font-relative-position: Centered
            Font-file: @Eurostile-ExtendedTwo.otf
            Position:
                Horizontal: Center on x: 285
                Vertical: Top-left + 50px     
                


Component: First Task button
    Top-left: (x: 15, y: 160)
