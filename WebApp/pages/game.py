from __init__ import *
from pages.nav import *
import datetime
from utils import *
from app import app
from globals import player_options
# Fetch player names from the database

contract_names = ['Small', 'Guard', 'Guard without', 'Guard against']
# Create options for dbc.Select
contract_options = [{'label': name, 'value': name} for name in contract_names]
initial_colors = {'btn-petit_au_bout': 'secondary', 'btn-misery': 'secondary'}

main_game = html.Div(
    [
        navbar,  # add the navbar from nav.py
        dcc.Store(id='store-number-of-players'),
        html.Br(),  # Vertical space
        html.Br(),

        dbc.Card(
            [
                dbc.CardHeader(html.H2("Game menu", className="text-center mr-1",)),
                dbc.CardBody([
                    # Add scrolling menus for player selection
                    html.Hr(),
                    html.H5("Select Players:", className="card-title", style={"text-align": "center"}),
                    dbc.Row([
                        dbc.Col(dbc.Select(id='player-select-1', options=player_options, placeholder="Select Player 1"), width=2),
                        dbc.Col(dbc.Select(id='player-select-2', options=player_options, placeholder="Select Player 2"), width=2),
                        dbc.Col(dbc.Select(id='player-select-3', options=player_options, placeholder="Select Player 3"), width=2),
                        dbc.Col(dbc.Select(id='player-select-4', options=player_options, placeholder="Select Player 4"), width=2),
                        dbc.Col(dbc.Select(id='player-select-5', options=player_options, placeholder="Select Player 5"), width=2),
                    ], justify="around"),
                    html.Hr(),
                    html.Hr(),
                    dbc.Row([
                        dbc.Col([html.H5("Taker:", className="card-title", style={"text-align": "center"}),
                        dbc.Row([
                            dbc.Col(dbc.Select(id='taker', options=[], placeholder="Select Player"), width=2),
                        ], justify="center"),
                        ]),
                        dbc.Col(
                            [
                               dbc.Checklist(
                                    options=[{"label": "Player called himself", "value": 1}],
                                    value=True,
                                    id='player-called-self',
                                    inline=True,
                                    switch=True,
                                ),
                                html.H5("Teammate:", className="card-title"),
                                dbc.Col(dbc.Select(id='teammate', options=[], placeholder="Select Player"), width=2),    
                            ],
                            width={"size": 4, "offset": 0},
                        ),
                        dbc.Col([html.H5("Contract:", className="card-title", style={"text-align": "center"}),
                        dbc.Row([
                            dbc.Col(dbc.Select(id='contract', options=contract_options, placeholder="Select Contract"), width=2),
                        ], justify="center"),
                        ]),
                        dbc.Col([
                            html.H5("Number of Oudlers:", className="card-title", style={"text-align": "center"}),
                            dbc.Row(
                                dbc.Col(
                                    dbc.Input(
                                        type="number",
                                        id="number-of-oudlers",
                                        min=0, max=3, step=1,
                                        placeholder="Enter number of Oudlers (0-3)",
                                    ),
                                width={"size": 10},  # Adjust width and offset to center the input field
                                ),
                                justify="center",
                            ),
                        ]),
                    ]),
                    html.Hr(),
                    dbc.Row([
                        dbc.Col([
                            html.H5("Additional Options:", className="card-title", style={"text-align": "center"}),
                            dbc.Row(
                                    [dbc.Button("Petit au Bout", id="btn-petit_au_bout", color=initial_colors['btn-petit_au_bout'], className="me-1"),
                                    dbc.Button("Misery", id="btn-misery", color=initial_colors['btn-misery'], className="me-1"),
                                    dbc.Button("Poignee", id="btn-poignee", color="secondary", className="me-1"),
                                    dbc.Button("2 Poignee", id="btn-2poignee", color="secondary", className="me-1"),
                                    dbc.Button("3 Poignee", id="btn-3poignee", color="secondary", className="me-1"),
                                    ],
                                    justify="center",
                            ),
                        ]),
                        dbc.Col([
                            html.H5("Score:", className="card-title", style={"text-align": "center"}),
                            dbc.Row(
                                dbc.Col(
                                    dbc.Input(
                                        type="number",
                                        id="number-of-points",
                                        max=91, min=0, step=1,
                                        placeholder="Enter number of points",
                                    ),
                                width={"size": 7},  # Adjust width and offset to center the input field
                                ),
                                justify="center",
                            ),
                        ]),
                    ]),
                    html.Hr(),
                    #Button to save game
                    dbc.Row(
                        dbc.Col(
                            dbc.Button("Save Game", color="primary", className="w-100", id = "save-game-button"),
                            width={"size": 4, "offset": 4},
                        ),
                        className="mt-3",  # Top margin
                    ),
                    
                ]),
            ],
        ),
        html.Div(id='page-game-content'),
    ],
    
)   

###########Various callbacks for the game page################


@app.callback(
    Output('taker', 'options'),
    [Input('player-select-1', 'value'),
     Input('player-select-2', 'value'),
     Input('player-select-3', 'value'),
     Input('player-select-4', 'value'),
     Input('player-select-5', 'value')]
)
def update_taker_options(*selected_players):
    """"
    Update the possible players for the taker dropdown based on the selected players
    """
    selected_players = [player for player in selected_players if player is not None]
    taker_options = [{'label': option['label'], 'value': option['value']} for option in player_options if option['value'] in selected_players]
    return taker_options

@app.callback(
    [Output('teammate', 'options'),
    Output('player-called-self', 'value')],
    [Input('player-called-self', 'value'),
     Input('player-select-1', 'value'),
     Input('player-select-2', 'value'),
     Input('player-select-3', 'value'),
     Input('player-select-4', 'value'),
     Input('player-select-5', 'value')]
)
def update_teammate_options(self_called, *selected_players):
    """"
    Update the possible players for the taker dropdown based on the selected players
    """
    selected_players = [player for player in selected_players if player is not None]
    print(self_called)
    if self_called:
        return [], self_called
    taker_options = [{'label': option['label'], 'value': option['value']} for option in player_options if option['value'] in selected_players]
    return taker_options, not self_called

@app.callback(
    Output('store-number-of-players', 'data'),  # Update to store data
    [Input('player-select-1', 'value'),
     Input('player-select-2', 'value'),
     Input('player-select-3', 'value'),
     Input('player-select-4', 'value'),
     Input('player-select-5', 'value')]
)
def update_number_of_players(player1, player2, player3, player4, player5):
    """
    Update the number of selected players
    """
    selected_players = len([player for player in [player1, player2, player3, player4, player5] if player])
    return {'num_players': selected_players}

@app.callback(
    [Output('btn-petit_au_bout', 'color'), Output('btn-misery', 'color'), Output('btn-poignee', 'color'), Output('btn-2poignee', 'color'), Output('btn-3poignee', 'color')],
    [Input('btn-petit_au_bout', 'n_clicks'), Input('btn-misery', 'n_clicks'), Input('btn-poignee', 'n_clicks'), Input('btn-2poignee', 'n_clicks'), Input('btn-3poignee', 'n_clicks')],
    [State('btn-petit_au_bout', 'color'), State('btn-misery', 'color'), State('btn-poignee', 'color'), State('btn-2poignee', 'color'), State('btn-3poignee', 'color')]
)
def update_button_colors(btn_petit_clicks, btn_misery_clicks, btn_poignee_clicks, btn_2poignee_clicks, btn_3poignee_clicks, petit_color, misery_color, poignee_color, poignee2_color, poignee3_color):
    """
    Update the color of the different buttons to determined if the different
    options are for the attacking or defending team
    """
    ctx = dash.callback_context
    if not ctx.triggered:
        return ['secondary', 'secondary', 'secondary', 'secondary', 'secondary']
    else:
        button_id = ctx.triggered[0]['prop_id'].split('.')[0]
        if button_id == 'btn-petit_au_bout':
            current_color = petit_color
        elif button_id == 'btn-misery':
            current_color = misery_color
        elif button_id == 'btn-poignee':
            current_color = poignee_color
        elif button_id == 'btn-2poignee':
            current_color = poignee2_color
        elif button_id == 'btn-3poignee':
            current_color = poignee3_color
        
        # Cycle through the colors: secondary -> danger -> success -> secondary
        if current_color == 'secondary':
            new_color = 'danger'
        elif current_color == 'danger':
            new_color = 'success'
        else:
            new_color = 'secondary'
        if button_id == 'btn-petit_au_bout':
            return [new_color, dash.no_update, dash.no_update, dash.no_update, dash.no_update]
        elif button_id == 'btn-misery':
            return [dash.no_update, new_color, dash.no_update, dash.no_update, dash.no_update]
        elif button_id == 'btn-poignee':
            return [dash.no_update, dash.no_update, new_color, dash.no_update, dash.no_update]
        elif button_id == 'btn-2poignee':
            return [dash.no_update, dash.no_update, dash.no_update, new_color, dash.no_update]
        elif button_id == 'btn-3poignee':
            return [dash.no_update, dash.no_update, dash.no_update, dash.no_update, new_color]
        # Update the button color
    
##########################################################
# Main Code to compute points for the different playters #
##########################################################

@app.callback(
    Output('page-game-content', 'children'),
    [Input('contract', 'value'),
     Input('number-of-oudlers', 'value'),
     Input('number-of-points', 'value'),
     Input('save-game-button', 'n_clicks'),
     Input('store-number-of-players', 'data'),
     Input('player-called-self', 'value'),
     Input('player-select-1', 'value'),
     Input('player-select-2', 'value'),
     Input('player-select-3', 'value'),
     Input('player-select-4', 'value'),
     Input('player-select-5', 'value'),
     Input('taker', 'value'),
     Input('teammate', 'value'),],
     [State('btn-petit_au_bout', 'color'),
     State('btn-misery', 'color'),
     State('btn-poignee', 'color'),
     State('btn-2poignee', 'color'),
     State('btn-3poignee', 'color')]
)
def compute_points(contract, oudlers, num, n_clicks, num_players_data, self_called, player_1, player_2, player_3, player_4, player_5, taker, teammate, petit_color, misery_color, poignee_color, poignee2_color, poignee3_color):
    #check if month exists in database
    date = str(get_month()) + '_' + str(get_year())
    if not os.path.exists(os.path.join(database_path, f'scores_{date}.csv')):
        #create scores database
        with open(os.path.join(database_path, f'scores_{date}.csv'), 'w') as f:
            f.write('ID,Ngames,Score,Mean,Std,Taker,BiggestWin,Biggestloss\n')
    if n_clicks is not None:
        if contract is None or oudlers is None or num is None or taker is None:
            alert = dbc.Alert("Please fill in all the fields", color="danger", style={"maxWidth": "500px"})
        else: 
            num_players = num_players_data.get('num_players', 0) if num_players_data else 0
            players = [player_1, player_2, player_3, player_4, player_5]
            print(players)
            bonuses=[]
            if num_players < 3:
                alert = dbc.Alert("Please select at least 3 players", color="danger", style={"maxWidth": "500px"})
            else:
                points = num
                coeff = 1
                point_to_make = 56
                # Add points for oudlers
                if oudlers == 0:
                    point_to_make = 56
                elif oudlers == 1:
                    point_to_make = 51
                elif oudlers == 2:
                    point_to_make = 41
                elif oudlers == 3:
                    point_to_make = 36
                # Compute the number of points made
                points = (points - point_to_make)
                if petit_color != 'secondary':
                    if petit_color == 'danger':
                        points = points - 10
                        bonuses.append(-1)
                    else:
                        points = points + 10
                        bonuses.append(1)
                else:
                    bonuses.append(0)
                if misery_color != 'secondary':
                    if misery_color == 'danger':
                        points = points - 10
                        bonuses.append(-1)
                    else:
                        points = points + 10
                        bonuses.append(1)
                else:
                    bonuses.append(0)
                # Compute the number of points based on the contract
                if contract == 'Small':
                    coeff = 1
                elif contract == 'Guard':
                    coeff = 2 
                elif contract == 'Guard without':
                    coeff = 4
                elif contract == 'Guard against':
                    coeff = 6
                points = (points - point_to_make)*coeff
                # Add points for additional options
                if poignee_color != 'secondary':
                    if poignee_color == 'danger':
                        points = points - 20
                        bonuses.append(-1)
                    else:
                        points = points + 20
                        bonuses.append(1)
                else:
                    bonuses.append(0)
                if poignee2_color != 'secondary':
                    if poignee2_color == 'danger':
                        points = points - 30
                        bonuses.append(-1)
                    else:
                        points = points + 30
                        bonuses.append(1)
                else:
                    bonuses.append(0)
                if poignee3_color != 'secondary':
                    if poignee3_color == 'danger':
                        points = points - 40
                        bonuses.append(-1)
                    else:
                        points = points + 40
                        bonuses.append(1)
                else:
                    bonuses.append(0)
                if points < 0:
                    lost_points = -points
                    alert = dbc.Alert(f"Team has lost {lost_points} points", color="danger", style={"maxWidth": "500px"})
                else:
                    alert = dbc.Alert(f"Team has won {points} points", color="success", style={"maxWidth": "500px"})
                
                player_called_himself = not self_called
                players_id = [get_player_id(player.split(' ')[1], player.split(' ')[0]) for player in players]
                taker_id = get_player_id(taker.split(' ')[1], taker.split(' ')[0])
                teammate_id = get_player_id(teammate.split(' ')[1], teammate.split(' ')[0]) if not player_called_himself else None
                write_game_to_database(num_players, players_id, taker_id, contract, player_called_himself, teammate_id, oudlers, bonuses, points, point_to_make)
                #compute scores for each player
                score = 0
                for player in players:
                    if player is not None:
                        player_name = player.split(' ')[1]
                        player_surname = player.split(' ')[0]
                        player_id = get_player_id(player_name, player_surname)
                        if num_players == 5 :
                            if self_called:
                                if player == taker:
                                    score = points * 4
                                else :
                                    score = -points
                            else: 
                                if player == taker:
                                    score = points * 3
                                elif player == teammate:
                                    score = points
                                else:
                                    score = -points
                        # write_score_to_database(score, player_id)
                
        return dbc.Row(
            dbc.Col(
                alert,
                width={"size": 6, "offset":1},  # Adjust size and offset for centering
            ),
            justify="center",  # Ensure the column is centered in the row
        )
    else :
        return None

