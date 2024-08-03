from __init__ import *
import datetime

def get_players_names():
    #returns the list of player names
    with open(os.path.join(database_path, 'players.csv'), 'r') as f:
        df = pd.read_csv(f)
        df['Full Name'] = df['Surname'] + ' ' + df['Name']
        return df['Full Name'].tolist()
    
def get_max_id():
    #returns the maximum id in the players database
    with open(os.path.join(database_path, 'players.csv'), 'r') as f:
        df = pd.read_csv(f)
        print(df['ID'].max())
        return df['ID'].max()
    
def get_player_id(name, surname):
    #returns the id of a player given his name and surname
    with open(os.path.join(database_path, 'players.csv'), 'r') as f:
        df = pd.read_csv(f, dtype={'ID': int})
        return df[(df['Name'] == name) & (df['Surname'] == surname)]['ID'].values[0]
    
def write_game_to_database(n_players,players_id, taker_id, contract, self_called, teammate_id, n_oudlers, bonuses, points, nominal_score):
    #write the game to the database
    date = str(datetime.datetime.now().day) + '_' + str(datetime.datetime.now().month) + '_' + str(datetime.datetime.now().year)
    with open(os.path.join(database_path, 'games.csv'), 'a') as f:
        f.write(f'{date},{n_players},{players_id},{taker_id},{contract},{self_called},{teammate_id},{n_oudlers},{bonuses},{points},{nominal_score}\n')
    

def write_score_to_database(score, player_id, taker_id):
    new_player_month = False
    new_player_all = False
    date = str(get_month()) + '_' + str(get_year())
    df_month = pd.read_csv(os.path.join(database_path, f'scores_{date}.csv'), dtype={'ID': int, 'Ngames': int, 'Taker':int, 'BiggestWin': int, 'BiggestLoss': int})
    #check if player is in the database
    if player_id not in df_month['ID'].values:
        new_player_month=True
        new_player = pd.DataFrame({'ID': [player_id], 'Ngames': [0], 'Score': [0], 'Mean': [0], 'Std': [0], 'Taker' : [0], 'BiggestWin': [0], 'BiggestLoss': [0]})
        df_month = pd.concat([df_month, new_player], ignore_index=True)
    df = pd.read_csv(os.path.join(database_path, 'scores.csv'),dtype={'ID': int, 'Ngames': int, 'Taker':int, 'BiggestWin': int, 'BiggestLoss': int})
    #check if player is in the database
    if player_id not in df['ID'].values:
        new_player_all = True
        new_player = pd.DataFrame({'ID': [player_id], 'Ngames': [0], 'Score': [0], 'Mean': [0], 'Std': [0], 'Taker' : [0], 'BiggestWin': [0], 'BiggestLoss': [0]})
        df = pd.concat([df, new_player], ignore_index=True)
    #increase scores in the database for the player
    current_ngames = df.loc[df['ID'] == player_id, 'Ngames'].values[0]
    current_ngames_month = df_month.loc[df_month['ID'] == player_id, 'Ngames'].values[0]
    current_std = df.loc[df['ID'] == player_id, 'Std'].values[0]
    current_std_month = df_month.loc[df_month['ID'] == player_id, 'Std'].values[0]
    current_mean = df.loc[df['ID'] == player_id, 'Mean'].values[0]
    current_mean_month = df_month.loc[df_month['ID'] == player_id, 'Mean'].values[0]

    df.loc[df['ID'] == player_id, 'Ngames'] += 1
    df_month.loc[df_month['ID'] == player_id, 'Ngames'] += 1
    df.loc[df['ID'] == player_id, 'Score'] += score
    df_month.loc[df_month['ID'] == player_id, 'Score'] += score

    if new_player_month:
        df_month.loc[df_month['ID'] == player_id, 'Taker'] = 0
    if new_player_all:
        df.loc[df['ID'] == player_id, 'Taker'] = 0

    if player_id == taker_id :
        df.loc[df['ID'] == player_id, 'Taker'] += 1
        df_month.loc[df_month['ID'] == player_id, 'Taker'] += 1
    else: 
        df.loc[df['ID'] == player_id, 'Taker'] += 0
        df_month.loc[df_month['ID'] == player_id, 'Taker'] += 0
    #compute new_mean
    df.loc[df['ID'] == player_id, 'Mean'] = df.loc[df['ID'] == player_id, 'Score'] / df.loc[df['ID'] == player_id, 'Ngames']
    df_month.loc[df_month['ID'] == player_id, 'Mean'] = df_month.loc[df_month['ID'] == player_id, 'Score'] / df_month.loc[df_month['ID'] == player_id, 'Ngames']

    #compute new_std
    if current_ngames>2:
        new_std = (current_ngames-1)/current_ngames*(current_std + current_ngames/(current_ngames**2-1)*(current_mean-score)**2)
        new_std_month = (current_ngames_month-1)/current_ngames_month*(current_std_month+current_ngames_month/(current_ngames_month**2-1)*(current_mean_month-score)**2)
    else:
        new_std = 0
        new_std_month = 0
    df.loc[df['ID'] == player_id, 'Std'] = new_std
    df_month.loc[df_month['ID'] == player_id, 'Std'] = new_std_month

    #check for biggest win and loss
    if score > df.loc[df['ID'] == player_id, 'BiggestWin'].values[0]:
        df.loc[df['ID'] == player_id, 'BiggestWin'] = score
    if score < df.loc[df['ID'] == player_id, 'BiggestLoss'].values[0]:
        df.loc[df['ID'] == player_id, 'BiggestLoss'] = score

    df_month.to_csv(os.path.join(database_path, f'scores_{date}.csv'), index=False)
    df.to_csv(os.path.join(database_path, 'scores.csv'), index=False)



def get_month():
    """
    Return the current month as an integer
    """
    return datetime.datetime.now().month

def get_year():
    """
    Return the current year as an integer
    """
    return datetime.datetime.now().year